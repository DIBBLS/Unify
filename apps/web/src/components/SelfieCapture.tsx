import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Check } from 'lucide-react';
import { grabFrame, preparePhoto } from '../lib/image';

// Front-camera selfie for attendance. The photo stays on the phone until the
// student taps "Use photo", is shrunk to ~50 KB, and is only ever shown to the
// lecturer or class rep running that session. If the camera is blocked, a
// normal photo picker (which opens the camera on phones) is the fallback.
export default function SelfieCapture({ onUse }: { onUse: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let gone = false;
    if (shot) return;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 } }, audio: false });
        if (gone) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          v.setAttribute('playsinline', 'true');
          await v.play().catch(() => {});
          setLive(true);
        }
      } catch {
        setErr('The camera is blocked. Allow the camera for this site, or choose a photo below.');
      }
    })();
    return () => { gone = true; stop(); };
  }, [shot]);

  const take = async () => {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy(true);
    try {
      const { dataUrl } = await grabFrame(v, { size: 480, maxBytes: 70 * 1024 });
      stop();
      setLive(false);
      setShot(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not take the photo.');
    } finally {
      setBusy(false);
    }
  };

  const fromFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      const { dataUrl } = await preparePhoto(f, { size: 480, maxBytes: 70 * 1024 });
      stop();
      setShot(dataUrl);
      setErr('');
    } catch {
      setErr('That photo could not be read. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      <div className="selfie-stage">
        {shot ? (
          <img src={shot} alt="Your photo" className="selfie-img" />
        ) : (
          <>
            <video ref={videoRef} muted playsInline className="selfie-video" aria-label="Front camera" />
            <div className="selfie-ring" aria-hidden="true" />
            {!live && !err && <div className="selfie-wait">Opening camera…</div>}
          </>
        )}
      </div>
      {err && <div role="alert" className="t-13" style={{ color: 'var(--u-red, #dc2626)', textAlign: 'center' }}>{err}</div>}
      {shot ? (
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button className="btn btn--white" style={{ flex: 1 }} onClick={() => setShot(null)}><RefreshCw size={16} /> Retake</button>
          <button className="btn btn--amber" style={{ flex: 1 }} onClick={() => onUse(shot)}><Check size={16} /> Use photo</button>
        </div>
      ) : (
        <>
          {!err && (
            <button className="selfie-shutter" onClick={() => void take()} disabled={!live || busy} aria-label="Take photo">
              <Camera size={22} />
            </button>
          )}
          <label className="btn btn--white btn--sm" style={{ cursor: 'pointer' }}>
            Choose a photo instead
            <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={(e) => void fromFile(e.target.files?.[0] || null)} />
          </label>
        </>
      )}
    </div>
  );
}
