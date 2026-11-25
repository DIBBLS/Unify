import { supabaseBrowser } from './supabase';
import { describeError } from './errors';
import { preparePhoto } from './image';

const BUCKET = 'diagrams';
// The original may be big (phone photos): it is cropped and shrunk on the device first.
const MAX_BYTES = 20 * 1024 * 1024;
// Review 4: every Studio diagram is the same shape and size. Centre-cropped to
// 16:9 at 1280×720, white behind transparency, saved as a JPEG under ~300 KB.
export const DIAGRAM_ASPECT = 16 / 9;
export const DIAGRAM_WIDTH = 1280;
// Author diagram upload (BUG-003): image file -> Supabase Storage public
// URL, stored as the diagram block's imageRef. Validated client-side.
export async function uploadDiagram(file: File, course: string, week: number): Promise<{ url?: string; error?: string }> {
  if (file.type && !file.type.startsWith('image/')) return { error: 'Only image files (PNG/JPG/SVG) can be uploaded.' };
  if (file.size > MAX_BYTES) return { error: 'Image must be under 20 MB.' };
  let blob: Blob;
  try {
    ({ blob } = await preparePhoto(file, { aspect: DIAGRAM_ASPECT, size: DIAGRAM_WIDTH, maxBytes: 300 * 1024, quality: [0.9, 0.82, 0.74] }));
  } catch {
    return { error: "Couldn't open that file as a picture. Try a PNG or JPG." };
  }
  const sb = supabaseBrowser();
  if (!sb) return { error: 'Sign-in session missing. Reload and retry.' };
  const safeCourse = (course || 'misc').replace(/[^A-Za-z0-9]+/g, '').slice(0, 12) || 'misc';
  const safeName = file.name.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(-50) || 'diagram';
  const path = `${safeCourse}/w${week}/${Date.now()}-${safeName}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  if (error) return { error: describeError(error, 'upload that file') };
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) return { error: 'Upload worked but no public URL came back.' };
  return { url: data.publicUrl };
}

// Profile pictures, the same way as diagrams: straight from the browser to
// Storage with the signed-in session. Each upload gets a new name inside the
// user's own folder (insert only, no overwrite), so no stale copy is served.
export async function uploadAvatarFile(blob: Blob): Promise<{ url?: string; error?: string }> {
  const sb = supabaseBrowser();
  if (!sb) return { error: 'Sign-in session missing. Reload and retry.' };
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { error: 'Sign-in session missing. Reload and retry.' };
  const path = `${uid}/${Date.now()}.jpg`;
  const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  if (error) return { error: describeError(error, 'upload that picture') };
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  if (!data?.publicUrl) return { error: 'Upload worked but no public URL came back.' };
  return { url: data.publicUrl };
}
