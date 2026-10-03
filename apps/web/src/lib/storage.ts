import { supabaseBrowser } from './supabase';

const BUCKET = 'diagrams';
const MAX_BYTES = 5 * 1024 * 1024;

// Author diagram upload (BUG-003): image file -> Supabase Storage public
// URL, stored as the diagram block's imageRef. Validated client-side.
export async function uploadDiagram(file: File, course: string, week: number): Promise<{ url?: string; error?: string }> {
  if (!file.type.startsWith('image/')) return { error: 'Only image files (PNG/JPG/SVG) can be uploaded.' };
  if (file.size > MAX_BYTES) return { error: 'Image must be under 5 MB.' };
  const sb = supabaseBrowser();
  if (!sb) return { error: 'Sign-in session missing. Reload and retry.' };
  const safeCourse = (course || 'misc').replace(/[^A-Za-z0-9]+/g, '').slice(0, 12) || 'misc';
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-60);
  const path = `${safeCourse}/w${week}/${Date.now()}-${safeName}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) return { error: 'Upload worked but no public URL came back.' };
  return { url: data.publicUrl };
}
