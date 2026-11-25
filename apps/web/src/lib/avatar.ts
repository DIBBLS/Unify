import { api, clearMeCache } from './api';
import { preparePhoto } from './image';
import { uploadAvatarFile } from './storage';
import { APP_VERSION } from './version';

// One way to set a profile picture, used by Me and the lecturer welcome:
// square 320px JPEG made on the phone, uploaded straight to Storage (the same
// way Studio uploads diagrams), then the URL saved on the profile. If the
// direct upload is refused, the picture goes through the API instead.
export async function saveProfilePhoto(file: File): Promise<string> {
  const { blob, dataUrl } = await preparePhoto(file, { size: 320, maxBytes: 60 * 1024 });
  const up = await uploadAvatarFile(blob);
  if (!up.url) {
    // Record why the direct route failed (shows under admin's recent app
    // errors), then carry on through the API so the person still gets a picture.
    void api.logError({ kind: 'avatar-direct-upload', message: up.error || 'no URL returned', stack: '', url: window.location.pathname, appVersion: APP_VERSION }).catch(() => {});
  }
  const res = up.url ? await api.setAvatarUrl(up.url) : await api.uploadAvatar(dataUrl);
  // A cached /me still holds the old picture; drop it so every screen updates.
  clearMeCache();
  window.dispatchEvent(new CustomEvent('unify:avatar', { detail: res.avatarUrl }));
  return res.avatarUrl;
}
