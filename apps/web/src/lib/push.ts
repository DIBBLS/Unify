import { api } from './api';

// Web Push (browser push notifications) client. Needs the backend VAPID
// keys (Render) + the public key below, which must MATCH the backend pair.
// Override with VITE_VAPID_PUBLIC_KEY if the backend pair ever rotates.
const FALLBACK_VAPID_PUBLIC_KEY =
  'BHKtPADFVrSJRgZfuvBHtut4FCkj_y_9Y8LPlQ040sv1aiiZdtOc7M7MFlsvnzVparxVVxdh2i42gZlEaAs9OkI';

function vapidPublicKey(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = window.atob(raw);
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export type PushState = 'unsupported' | 'denied' | 'on' | 'off';

// Current state: needs an awaited service-worker lookup for 'on'.
export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

// Enable: permission prompt -> subscribe -> register with backend.
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'This browser cannot do push notifications.' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'Permission was not granted.' };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey()),
    });
    const json = sub.toJSON();
    await api.pushSubscribe(sub.endpoint, {
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Subscribe failed.' };
  }
}

// Disable: unsubscribe locally + drop the server row.
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const endpoint = sub?.endpoint;
    if (sub) await sub.unsubscribe().catch(() => {});
    await api.pushUnsubscribe(endpoint || undefined).catch(() => {});
  } catch {
    // best-effort — the toggle still flips
  }
}
