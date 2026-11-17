// Shared by InstallBar (owns the prompt) and any button that wants to ask for
// an install (Me page). Keeps the beforeinstallprompt plumbing in one place.
export const INSTALL_EVENT = 'unify:install';

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

export function isIOS(): boolean {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Ask InstallBar to start the install (Android prompt, or the iPhone steps). */
export function askInstall(): void {
  window.dispatchEvent(new Event(INSTALL_EVENT));
}

// Whether the browser handed us an install prompt (Android/desktop Chrome).
// InstallBar owns the event; the setup sheet only needs to know it exists.
export const INSTALLABLE_EVENT = 'unify:installable';
let installable = false;
export function markInstallable(v: boolean): void {
  installable = v;
  try {
    window.dispatchEvent(new Event(INSTALLABLE_EVENT));
  } catch {
    // ignore
  }
}
export function canPromptInstall(): boolean {
  return installable;
}
