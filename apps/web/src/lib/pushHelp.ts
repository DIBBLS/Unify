// Notification permission differs a lot between browsers: some only ask on a
// tap, some hide the prompt behind an address-bar icon, iPhones need the app
// on the Home Screen first, and in-app browsers (Facebook, Instagram, WhatsApp)
// cannot do it at all. This works out which case the person is in and gives
// plain steps, so a blocked prompt is never a dead end.

export type Env = {
  os: 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'other';
  browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'brave' | 'opera' | 'inapp' | 'other';
  standalone: boolean;
};

export function detectEnv(): Env {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const iPadOS = /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
  const os: Env['os'] =
    /iPhone|iPad|iPod/.test(ua) || iPadOS ? 'ios' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : /Mac OS X/.test(ua) ? 'mac' : /Linux|CrOS/.test(ua) ? 'linux' : 'other';
  const brave = typeof navigator !== 'undefined' && !!(navigator as unknown as { brave?: unknown }).brave;
  const browser: Env['browser'] = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\)|WhatsApp|Twitter/i.test(ua)
    ? 'inapp'
    : brave
      ? 'brave'
      : /SamsungBrowser/.test(ua)
        ? 'samsung'
        : /Edg\//.test(ua)
          ? 'edge'
          : /OPR\/|Opera/.test(ua)
            ? 'opera'
            : /Firefox|FxiOS/.test(ua)
              ? 'firefox'
              : /Chrome|CriOS/.test(ua)
                ? 'chrome'
                : /Safari/.test(ua)
                  ? 'safari'
                  : 'other';
  let standalone = false;
  try {
    standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    // keep false
  }
  return { os, browser, standalone };
}

export type GuideKind = 'blocked' | 'unsupported' | 'dismissed' | 'failed';
export type Guide = { title: string; lead: string; steps: string[]; foot: string };

const FOOT = 'You will still get every notice on the bell inside Unify and by email. Push only adds the lock-screen buzz.';

export function pushGuide(kind: GuideKind, env: Env = detectEnv()): Guide {
  const { os, browser, standalone } = env;

  if (kind === 'unsupported') {
    if (browser === 'inapp')
      return {
        title: 'Open Unify in your browser',
        lead: 'This view (inside Facebook, Instagram or WhatsApp) cannot show notifications.',
        steps: [os === 'ios' ? 'Tap the share or ⋯ icon, then "Open in Safari".' : 'Tap the ⋮ menu, then "Open in browser" (Chrome).', 'Sign in again there and turn notifications on in Profile.'],
        foot: FOOT,
      };
    if (os === 'ios' && !standalone)
      return {
        title: 'Add Unify to your Home Screen first',
        lead: 'iPhones only allow notifications for apps added to the Home Screen (iOS 16.4 or newer).',
        steps: ['In Safari, tap the Share button.', 'Choose "Add to Home Screen", then Add.', 'Open Unify from the new icon, go to Profile and turn on Push notifications.', 'Tap Allow when iOS asks.'],
        foot: FOOT,
      };
    return {
      title: 'This browser cannot send notifications',
      lead: 'It does not support web push (or it is in private mode).',
      steps: ['Open Unify in the latest Chrome, Edge, Firefox or Safari.', 'Leave private or incognito mode, which blocks notifications.'],
      foot: FOOT,
    };
  }

  const how: Record<Env['browser'], string[]> = {
    chrome:
      os === 'android'
        ? ['Tap the ⋮ menu, then the lock or ⓘ icon next to the address.', 'Open Permissions (or Site settings), then Notifications.', 'Choose Allow, then come back and press the button again.']
        : ['Click the lock (or tune) icon left of the address bar.', 'Set Notifications to Allow.', 'Reload the page and press the button again.'],
    edge: ['Click the lock icon left of the address bar.', 'Open Permissions for this site and set Notifications to Allow.', 'Reload and press the button again.'],
    firefox: ['Click the lock icon left of the address bar.', 'Next to "Receive notifications", remove the Blocked setting (click the x).', 'Reload and press the button again. Firefox only asks after a tap.'],
    safari:
      os === 'ios'
        ? ['Open Settings, then Notifications, then Unify.', 'Turn on Allow Notifications.', 'If Unify is not listed, add it to the Home Screen first and open it from there.']
        : ['Open Safari, then Settings, then Websites, then Notifications.', 'Set this site to Allow.', 'Reload and press the button again.'],
    samsung: ['Tap the ☰ menu, then Settings, then Sites and downloads, then Notifications.', 'Find this site and set it to Allow.', 'Come back and press the button again.'],
    brave: ['Brave blocks push by default. Open brave://settings/privacy.', 'Turn on "Use Google services for push messaging", then relaunch.', 'Click the lock icon, set Notifications to Allow, and press the button again.'],
    opera: ['Click the lock icon left of the address bar.', 'Set Notifications to Allow.', 'Reload and press the button again.'],
    inapp: ['Open Unify in your normal browser (Chrome or Safari) first.'],
    other: ["Open this site's permissions from the address bar, set Notifications to Allow, then reload."],
  };

  if (kind === 'dismissed')
    return {
      title: 'The permission box was closed',
      lead: 'Your browser asked, but the box was dismissed, so nothing changed.',
      steps: [
        'Press "Turn on" again and tap Allow when the box appears.',
        os === 'android' || os === 'ios' ? 'If no box appears, check that notifications are not switched off for your browser in the phone settings.' : 'If no box appears, look for a bell icon in the address bar and click it.',
      ],
      foot: FOOT,
    };
  if (kind === 'failed')
    return {
      title: 'Notifications could not be switched on',
      lead: 'Permission is fine, but the browser could not finish setting up push.',
      steps: [
        'Check your internet connection and try again.',
        browser === 'brave' ? 'In Brave, turn on "Use Google services for push messaging" in brave://settings/privacy.' : 'Reload Unify, then press "Turn on" again.',
        'If it keeps failing, use another browser or add Unify to your Home Screen.',
      ],
      foot: FOOT,
    };
  return { title: 'Notifications are blocked', lead: 'Your browser has this site on "Blocked", so it will not ask again until you allow it.', steps: how[browser], foot: FOOT };
}
