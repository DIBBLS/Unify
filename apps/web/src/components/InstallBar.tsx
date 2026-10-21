import { useEffect, useState } from 'react';
import { ArrowDownToLine, RefreshCw, X } from 'lucide-react';

// PWA install + update notifier, bottom-left (ZoomBar owns bottom-right).
//  - Chrome/Android: captures beforeinstallprompt → full bar first;
//    dismissing collapses it to a small pill (never fully gone until the
//    user closes the pill or installs).
//  - iOS Safari: no prompt event — shows the "Share → Add to Home Screen"
//    recipe once, then the same pill reopens it.
//  - Update: a new service worker activating over a live one raises a
//    pulsing "Update ready" pill — tap to reload onto the new version.
const HIDE = 'unify.install.hide';
const PILL = 'unify.install.pill';
const SEEN = 'unify.install.seen';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function ls(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function setLs(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore
  }
}

export default function InstallBar() {
  const [pie, setPie] = useState<BIPEvent | null>(null);
  // 'hidden' | 'bar' (full prompt) | 'pill' (collapsed) | 'ios' (recipe)
  const [stage, setStage] = useState<'hidden' | 'bar' | 'pill' | 'ios'>('hidden');
  const [update, setUpdate] = useState(false);

  useEffect(() => {
    const w = window as unknown as { navigator: Navigator & { standalone?: boolean } };
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches === true || w.navigator.standalone === true;
    if (standalone) return; // already installed — never nag

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('onbeforeinstallprompt' in window);
    if (ls(HIDE) === null) {
      if (ls(PILL) || ls(SEEN)) setStage('pill');
      else if (isIOS) setStage('ios'); // recipe first, then pill
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setPie(e as BIPEvent);
      if (ls(HIDE) === null) setStage(ls(SEEN) ? 'pill' : 'bar');
    };
    const onInstalled = () => {
      setStage('hidden');
      setPie(null);
      setLs(HIDE, '1');
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);

    // Update detection: only a REAL update (an active worker existed
    // before this one started installing) — not the very first install.
    let cancelled = false;
    const watch = (attempt: number) => {
      void navigator.serviceWorker?.getRegistration?.().then((reg) => {
        if (!reg || cancelled) {
          if (attempt < 5) window.setTimeout(() => watch(attempt + 1), 1500);
          return;
        }
        const hadActive = Boolean(reg.active);
        const flag = () => {
          if (hadActive && !cancelled) setUpdate(true);
        };
        if (reg.waiting) flag();
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' || sw.state === 'activated') flag();
          });
        });
        void reg.update().catch(() => {});
      });
    };
    watch(0);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!pie) return;
    await pie.prompt();
    const choice = await pie.userChoice.catch(() => null);
    setPie(null);
    if (choice?.outcome === 'accepted') setStage('hidden');
    else setLs(SEEN, '1'), setStage('pill'); // dismissed → pill, not gone
  };

  const collapse = () => {
    setLs(SEEN, '1');
    setStage('pill');
  };
  const closePill = () => {
    setLs(HIDE, '1');
    setStage('hidden');
  };

  const showInstall = stage === 'bar' || stage === 'pill' || stage === 'ios';
  if (!showInstall && !update) return null;

  const wrap: React.CSSProperties = {
    position: 'fixed',
    left: 16,
    bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
    zIndex: 55,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
    maxWidth: 'min(320px, calc(100vw - 32px))',
  };
  const card: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    boxShadow: 'var(--shadow)',
    padding: '10px 12px',
    fontSize: 12,
    color: 'var(--text)',
  };
  const btnPill: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: 9999,
    border: 'none',
    background: '#10b981',
    color: '#fff',
    fontWeight: 800,
    fontSize: 12,
    cursor: 'pointer',
    display: 'inline-flex',
    gap: 6,
    alignItems: 'center',
  };

  return (
    <div className="screen-only" style={wrap}>
      {update && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ ...card, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontWeight: 800, color: 'var(--green-deep)' }}
          title="Load the new version"
        >
          <span className="update-dot" aria-hidden />
          <RefreshCw size={14} />
          Update ready — tap to refresh
        </button>
      )}

      {stage === 'bar' && (
        <div style={{ ...card, width: 300 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: '#059669', marginTop: 1 }}>
              <ArrowDownToLine size={18} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Install Unify Learn</div>
              <div style={{ color: 'var(--text2)', marginTop: 2 }}>
                One tap — opens full-screen, keeps your weeks readable offline.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button type="button" onClick={install} disabled={!pie} style={{ ...btnPill, opacity: pie ? 1 : 0.6 }}>
              Install
            </button>
            <button
              type="button"
              onClick={collapse}
              style={{ background: 'none', border: 'none', color: 'var(--text2)', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '7px 4px' }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {stage === 'ios' && (
        <div style={{ ...card, width: 300 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Add Unify to your home screen</div>
          <div style={{ color: 'var(--text2)', marginTop: 4 }}>
            Tap the <strong>Share</strong> button ▲ in Safari, then choose <strong>Add to Home Screen</strong>.
          </div>
          <button
            type="button"
            onClick={() => {
              setLs(SEEN, '1');
              setStage('pill');
            }}
            style={{ ...btnPill, marginTop: 10 }}
          >
            Got it
          </button>
        </div>
      )}

      {stage === 'pill' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9999, padding: '4px 4px 4px 12px', boxShadow: 'var(--shadow)', fontSize: 12, fontWeight: 800, color: 'var(--green-deep)' }}>
          <button
            type="button"
            onClick={() => (pie ? setStage('bar') : setStage('ios'))}
            style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', padding: 0 }}
          >
            <ArrowDownToLine size={14} /> Install app
          </button>
          <button
            type="button"
            onClick={closePill}
            aria-label="Hide install prompt"
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', padding: 6 }}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
