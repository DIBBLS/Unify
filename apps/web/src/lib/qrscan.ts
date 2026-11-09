// Reads QR codes from the camera. Uses the browser's BarcodeDetector where it
// exists (Chrome/Android: fast, on the GPU) and falls back to jsQR (iOS Safari).
// The fallback is loaded only when needed, so it costs nothing on other screens.
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
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    onError('Camera access was blocked. Allow the camera for this site, or use the class QR instead.');
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

  let busy = false;
  const timer = window.setInterval(async () => {
    if (stopped || busy || video.readyState < 2 || !video.videoWidth) return;
    busy = true;
    try {
      if (detector) {
        const found = await detector.detect(video);
        if (found[0]?.rawValue) onCode(found[0].rawValue);
      } else if (jsQR && ctx) {
        const w = 480;
        canvas.width = w;
        canvas.height = Math.round((video.videoHeight / video.videoWidth) * w);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (hit?.data) onCode(hit.data);
      }
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
