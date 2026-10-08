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

const AUDIO_BUCKET = 'audio';
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/x-m4a'];
const AUDIO_MAX = 15 * 1024 * 1024;

// Narrator audio upload: a Nigerian-voice MP3 (recorded by a contributor,
// lecturer, or generated once with any TTS tool) attached per topic. The
// reader plays it with speed control; device TTS stays the fallback.
export async function uploadNarration(file: File, course: string, week: number): Promise<{ url?: string; error?: string }> {
  if (!AUDIO_TYPES.includes(file.type) && !/\.(mp3|m4a|wav|ogg)$/i.test(file.name)) {
    return { error: 'Audio files only (MP3/M4A/WAV/OGG).' };
  }
  if (file.size > AUDIO_MAX) return { error: 'Audio must be under 15 MB.' };
  const sb = supabaseBrowser();
  if (!sb) return { error: 'Sign-in session missing. Reload and retry.' };
  const safeCourse = (course || 'misc').replace(/[^A-Za-z0-9]+/g, '').slice(0, 12) || 'misc';
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-60);
  const path = `${safeCourse}/w${week}/${Date.now()}-${safeName}`;
  const { error } = await sb.storage.from(AUDIO_BUCKET).upload(path, file, { contentType: file.type || 'audio/mpeg', upsert: false });
  if (error) return { error: error.message };
  const { data } = sb.storage.from(AUDIO_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) return { error: 'Upload worked but no public URL came back.' };
  return { url: data.publicUrl };
}
