// Reads QR codes from the camera. Uses the browser's BarcodeDetector where it
// exists (Chrome/Android: fast, on the GPU) and falls back to jsQR (iOS Safari).
// The fallback is loaded only when needed, so it costs nothing on other screens.
// Several codes in view at once (a row of students holding up passes) are all
// reported: BarcodeDetector returns every code in the frame; jsQR finds one per
// image, so it also reads overlapping tiles of a sharper frame (see TILES).
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export type ScanHandle = { stop: () => void };

export async function startQrScan(
  video: HTMLVideoElement,
  onCode: (text: string) => void,
  onError: (message: string) => void,
): Promise<ScanHandle> {
  let stream: MediaStream | null = null;
  let stopped = false;
  try {
    // Ask for a sharp picture: small QRs at arm's length need the pixels when several share the view.
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch {
    onError('Camera access was blocked. Allow the camera for this site, or type matric numbers below.');
    return { stop: () => {} };
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play().catch(() => {});

  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  const detector = BD ? new BD({ formats: ['qr_code'] }) : null;
  const jsQR = detector ? null : (await import('jsqr')).default;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Pass-sized tiles (a third of the width, half the height) stepping by half a
  // tile, so every code is whole and alone in some tile. jsQR can't read a frame
  // with several codes in it, but reads each tile. 15 tiles, 5 per tick: tested
  // to find 5 passes in one view within 3 ticks.
  const TW = 1 / 3;
  const TH = 1 / 2;
  const TILES = [0, 1 / 4, 2 / 4].flatMap((y) => [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6].map((x) => ({ x, y })));
  const PER_TICK = 5;
  let tile = 0;

  let busy = false;
  const timer = window.setInterval(async () => {
    if (stopped || busy || video.readyState < 2 || !video.videoWidth) return;
    busy = true;
    try {
      const codes = new Set<string>();
      if (detector) {
        for (const f of await detector.detect(video)) if (f.rawValue) codes.add(f.rawValue);
      } else if (jsQR && ctx) {
        const w = Math.min(960, video.videoWidth);
        const h = Math.round((video.videoHeight / video.videoWidth) * w);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const read = (x: number, y: number, tw: number, th: number) => {
          const img = ctx.getImageData(x, y, tw, th);
          const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (hit?.data) codes.add(hit.data);
        };
        read(0, 0, w, h);
        for (let i = 0; i < PER_TICK; i++) {
          const t = TILES[tile];
          tile = (tile + 1) % TILES.length;
          read(Math.round(t.x * w), Math.round(t.y * h), Math.round(w * TW), Math.round(h * TH));
        }
      }
      codes.forEach((c) => onCode(c));
    } catch {
      // a bad frame is skipped
    } finally {
      busy = false;
    }
  }, 220);

  return {
    stop: () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
