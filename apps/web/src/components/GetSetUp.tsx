import { useEffect, useState } from 'react';
import { Check, ArrowDownToLine, Bell } from 'lucide-react';
import { askInstall, canPromptInstall, INSTALLABLE_EVENT, isIOS, isStandalone } from '../lib/install';
import { enablePush, pushState, pushSupported, type PushState } from '../lib/push';
import { toastSuccess } from '../lib/toast';
import PushHelp from './PushHelp';
import type { GuideKind } from '../lib/pushHelp';

// First things first (17 Nov): until Unify Learn is installed on the phone and
// notifications are allowed, every app open starts with this sheet. Reminders,
// class changes and new notes only reach people who have done both.
// "Later" hides it for this visit only; it comes back on the next open.
const SNOOZE = 'unify.setup.later';
const isPhone = () => typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

function snoozed(): boolean {
  try { return sessionStorage.getItem(SNOOZE) === '1'; } catch { return false; }
}

export default function GetSetUp() {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());
  const [push, setPush] = useState<PushState>('off');
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<GuideKind | null>(null);

  // Desktop browsers: installing is optional, notifications are not.
  const needInstall = isPhone() && !installed;
  // iPhone: push only exists inside the installed app (iOS 16.4+).
  const iosNeedsInstall = isIOS() && !installed;
  const needPush = push !== 'on' && (pushSupported() || iosNeedsInstall);

  useEffect(() => {
    if (snoozed()) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void pushState().then((st) => {
        if (cancelled) return;
        setPush(st);
        const wantsInstall = isPhone() && !isStandalone();
        const wantsPush = st !== 'on' && (pushSupported() || (isIOS() && !isStandalone()));
        if (wantsInstall || wantsPush) setOpen(true);
      });
    }, 1500);
    const onInstallable = () => setCanPrompt(canPromptInstall());
    const onInstalled = () => setInstalled(true);
    window.addEventListener(INSTALLABLE_EVENT, onInstallable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.removeEventListener(INSTALLABLE_EVENT, onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Both done: close with a cheer.
  useEffect(() => {
    if (open && !needInstall && !needPush) {
      setOpen(false);
      toastSuccess("You're all set. Reminders will reach this phone.");
    }
  }, [open, needInstall, needPush]);

  if (!open) return null;

  const later = () => {
    try { sessionStorage.setItem(SNOOZE, '1'); } catch { /* ignore */ }
    setOpen(false);
  };
  const allow = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r.ok) setPush('on');
      else {
        if (r.kind === 'blocked') setPush('denied');
        setHelp(r.kind || 'failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const step = (n: number, done: boolean, icon: React.ReactNode, title: string, sub: React.ReactNode, action?: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: n > 1 ? '1px solid var(--border)' : 'none' }}>
      <span style={{ width: 32, height: 32, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--u-good)' : 'var(--u-good-tint)', color: done ? '#fff' : 'var(--u-good)' }}>
        {done ? <Check size={18} /> : icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 800, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text2)' : 'var(--text)' }}>{n}. {title}</span>
        {!done && <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{sub}</span>}
        {!done && action && <span style={{ display: 'block', marginTop: 8 }}>{action}</span>}
      </span>
    </div>
  );

  const installSub = isIOS()
    ? <>In Safari tap <strong>Share</strong> ▲, then <strong>Add to Home Screen</strong>. Then open Unify Learn from your home screen.</>
    : canPrompt
    ? 'Opens full-screen like any app, and keeps your weeks readable offline.'
    : <>Open your browser menu <strong>⋮</strong> and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</>;

  const pushSub = iosNeedsInstall
    ? 'On iPhone this works once Unify Learn is on your home screen. Open it from there and allow.'
    : push === 'denied'
    ? 'Notifications are blocked for Unify Learn. Tap below to see how to turn them back on.'
    : 'Study reminders, class changes, new notes and messages from your class rep.';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="getsetup-title" style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 'var(--shell, 480px)', background: 'var(--surface)', color: 'var(--text)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
          <img src="/icons/v5/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
          <div>
            <div id="getsetup-title" style={{ fontSize: 18, fontWeight: 800 }}>Get Unify Learn ready on this phone</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Two quick steps so nothing passes you by.</div>
          </div>
        </div>
        {isPhone() && step(1, installed, <ArrowDownToLine size={16} />, 'Install the app', installSub,
          !isIOS() && canPrompt ? <button className="btn btn--amber btn--sm" onClick={() => askInstall()}>Install</button> : undefined)}
        {step(isPhone() ? 2 : 1, push === 'on', <Bell size={16} />, 'Allow notifications', pushSub,
          iosNeedsInstall ? undefined
          : push === 'denied' ? <button className="btn btn--white btn--sm" onClick={() => setHelp('blocked')}>Show me how</button>
          : <button className="btn btn--amber btn--sm" disabled={busy} onClick={() => void allow()}>{busy ? 'Turning on…' : 'Allow notifications'}</button>)}
        <button onClick={later} style={{ display: 'block', width: '100%', marginTop: 6, background: 'none', border: 'none', color: 'var(--text2)', fontWeight: 700, fontSize: 13, padding: 10, cursor: 'pointer' }}>
          Later
        </button>
      </div>
      {help && <PushHelp kind={help} onClose={() => setHelp(null)} />}
    </div>
  );
}
