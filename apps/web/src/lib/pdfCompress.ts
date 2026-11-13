// Shrink a PDF on the phone before a lecturer sends it (Classroom › Send a
// PDF). Each page is redrawn at about 150 dpi as a JPEG and the pages are put
// back together: scans and photo-heavy slides drop a lot (a 15 MB scan is
// usually 2–4 MB), still sharp enough for slides and handwriting. If that
// doesn't come out smaller (text-only PDFs are already tiny), the original
// is sent untouched. The libraries load only here, never in the main app.
export const PDF_MAX_BYTES = 25 * 1024 * 1024;
const DPI = 150;
const QUALITY = 0.72;
const MAX_PAGES = 120; // beyond this, compressing on a phone takes too long

export type CompressResult = { file: File; before: number; after: number; compressed: boolean; pages: number };

export async function compressPdf(file: File, onProgress?: (done: number, total: number) => void): Promise<CompressResult> {
  const before = file.size;
  const [pdfjs, { jsPDF }, workerUrl] = await Promise.all([
    import('pdfjs-dist'),
    import('jspdf'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = (workerUrl as { default: string }).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = doc.numPages;
  if (pages > MAX_PAGES) return { file, before, after: before, compressed: false, pages };

  let out: InstanceType<typeof jsPDF> | null = null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { file, before, after: before, compressed: false, pages };
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 }); // 72 points per inch
    const view = page.getViewport({ scale: DPI / 72 });
    canvas.width = Math.ceil(view.width);
    canvas.height = Math.ceil(view.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: view }).promise;
    const jpg = canvas.toDataURL('image/jpeg', QUALITY);
    const orient = base.width > base.height ? 'landscape' : 'portrait';
    if (!out) out = new jsPDF({ orientation: orient, unit: 'pt', format: [base.width, base.height], compress: true });
    else out.addPage([base.width, base.height], orient);
    out.addImage(jpg, 'JPEG', 0, 0, base.width, base.height, undefined, 'FAST');
    page.cleanup();
    onProgress?.(i, pages);
  }
  void doc.destroy();
  if (!out) return { file, before, after: before, compressed: false, pages };
  const blob = out.output('blob');
  if (blob.size >= before * 0.95) return { file, before, after: before, compressed: false, pages };
  const name = file.name.replace(/\.pdf$/i, '') + '.pdf';
  return { file: new File([blob], name, { type: 'application/pdf' }), before, after: blob.size, compressed: true, pages };
}

export const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
