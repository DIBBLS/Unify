// On-device photo preparation: profile pictures and attendance selfies.
//
// Why this exists: phone cameras produce 3-12 MB photos, often rotated by EXIF,
// sometimes HEIC, and PNGs with transparency turn black when saved as JPEG.
// This reads the file robustly, fixes the rotation, centre-crops to a square,
// paints white behind transparency, and shrinks until the result is under a
// byte budget, so every picture loads fast on a student's data plan.

export type PrepOptions = { size?: number; maxBytes?: number; square?: boolean };

type Source = { draw: (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number) => void; width: number; height: number; close: () => void };

// iPhone photos (HEIC/HEIF) open natively only in Safari. Elsewhere we convert
// them to JPEG on the device first; the converter (~1 MB) downloads only when
// such a photo is actually picked, never on normal app load.
async function looksLikeHeic(file: Blob): Promise<boolean> {
  const name = (file as File).name || '';
  if (/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(name)) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const box = String.fromCharCode(...head.slice(4, 8));
    const brand = String.fromCharCode(...head.slice(8, 12));
    return box === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand);
  } catch {
    return false;
  }
}

async function heicToJpeg(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

/** Open any picture: native decode first, then convert formats the browser can't read. */
async function open(file: Blob): Promise<Source> {
  try {
    return await openNative(file);
  } catch (e) {
    if (!(await looksLikeHeic(file))) throw e;
    return openNative(await heicToJpeg(file));
  }
}

async function openNative(file: Blob): Promise<Source> {
  // Preferred: createImageBitmap honours EXIF rotation and decodes big photos off the main thread.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { width: bmp.width, height: bmp.height, draw: (c, sx, sy, sw, sh, dw, dh) => c.drawImage(bmp, sx, sy, sw, sh, 0, 0, dw, dh), close: () => bmp.close?.() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('unreadable image'));
      i.src = url;
    });
    return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, draw: (c, sx, sy, sw, sh, dw, dh) => c.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh), close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toBlob(cv: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('could not read the prepared image'));
    r.readAsDataURL(b);
  });
}

/** Turn any photo into a small JPEG data URL (square by default). */
export async function preparePhoto(file: Blob, opts: PrepOptions = {}): Promise<{ dataUrl: string; bytes: number }> {
  const size = opts.size ?? 320;
  const maxBytes = opts.maxBytes ?? 60 * 1024;
  const square = opts.square ?? true;
  const src = await open(file);
  try {
    const side = Math.min(src.width, src.height);
    const sx = square ? Math.round((src.width - side) / 2) : 0;
    const sy = square ? Math.round((src.height - side) / 2) : 0;
    const sw = square ? side : src.width;
    const sh = square ? side : src.height;
    let target = Math.min(size, Math.max(sw, sh));
    let best: Blob | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = target / Math.max(sw, sh);
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));
      const cv = document.createElement('canvas');
      cv.width = dw;
      cv.height = dh;
      const ctx = cv.getContext('2d');
      if (!ctx) throw new Error('This browser cannot prepare the photo.');
      ctx.fillStyle = '#ffffff'; // transparency becomes white, not black
      ctx.fillRect(0, 0, dw, dh);
      ctx.imageSmoothingQuality = 'high';
      src.draw(ctx, sx, sy, sw, sh, dw, dh);
      for (const q of [0.82, 0.7, 0.58]) {
        const b = await toBlob(cv, q);
        if (b && (!best || b.size < best.size)) best = b;
        if (b && b.size <= maxBytes) return { dataUrl: await blobToDataUrl(b), bytes: b.size };
      }
      target = Math.round(target * 0.82); // still too big: shrink and retry
    }
    if (!best) throw new Error('The photo could not be prepared.');
    return { dataUrl: await blobToDataUrl(best), bytes: best.size };
  } finally {
    src.close();
  }
}

/** A still frame from a live camera <video>, prepared the same way. */
export async function grabFrame(video: HTMLVideoElement, opts: PrepOptions = {}): Promise<{ dataUrl: string; bytes: number }> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('The camera is not ready yet.');
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('This browser cannot take the photo.');
  ctx.drawImage(video, 0, 0, w, h);
  const blob = await toBlob(cv, 0.92);
  if (!blob) throw new Error('The photo could not be taken.');
  return preparePhoto(blob, { size: 480, maxBytes: 70 * 1024, ...opts });
}
