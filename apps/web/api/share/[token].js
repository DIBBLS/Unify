// Vercel serverless: rich link previews for shared notes.
// Bots (WhatsApp/Telegram/X) don't run JS, so the SPA can't unfurl per
// link. This function fetches the share payload server-side and returns
// a standalone OG-tagged preview page: crawlers read the meta, humans
// get the card + a ride into the app. Responses cache at the edge.
const API_URL = (process.env.API_URL || 'https://unify-api-z4zm.onrender.com').replace(/\/$/, '');
const APP_URL = 'https://unify-virid.vercel.app';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function countdown(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return Math.max(1, Math.floor(ms / 60000)) + 'm left';
  if (h < 48) return h + 'h left';
  const d = Math.floor(h / 24);
  return d + ' day' + (d === 1 ? '' : 's') + ' left';
}

function page({ title, desc, image, body, appLink }) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>' + esc(title) + '</title>'
    + '<meta property="og:type" content="article"/>'
    + '<meta property="og:site_name" content="Unify Learn"/>'
    + '<meta property="og:title" content="' + esc(title) + '"/>'
    + '<meta property="og:description" content="' + esc(desc) + '"/>'
    + '<meta property="og:image" content="' + esc(image) + '"/>'
    + '<meta name="twitter:card" content="summary_large_image"/>'
    + '<meta name="twitter:title" content="' + esc(title) + '"/>'
    + '<meta name="twitter:description" content="' + esc(desc) + '"/>'
    + '<meta name="twitter:image" content="' + esc(image) + '"/>'
    + '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f5f4f0;color:#0a0a0a;padding:24px 16px}.card{max-width:480px;margin:0 auto;background:#0a0a0a;color:#f5f4f0;border-radius:16px;padding:28px 24px}.eyebrow{font-size:10px;font-weight:700;letter-spacing:2px;color:#4ade80;margin-bottom:8px}h1{font-size:24px;margin-bottom:8px}.sub{font-size:14px;font-style:italic;color:rgba(245,244,240,.65);margin-bottom:14px}.meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.chip{font-size:11px;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(245,244,240,.75)}.topics{background:#fff;border:1px solid #e0deda;border-radius:12px;padding:16px 18px;margin:14px auto;max-width:480px;font-size:13px;color:#555}.topics li{margin:0 0 6px 18px}.cta{display:block;max-width:480px;margin:0 auto;text-align:center;background:#10b981;color:#fff;font-weight:800;text-decoration:none;padding:14px;border-radius:9999px;border-bottom:4px solid #059669}.note{max-width:480px;margin:12px auto 0;text-align:center;font-size:12px;color:#777}</style>'
    + '</head><body>' + body
    + (appLink ? '<a class="cta" href="' + esc(appLink) + '">Open in Unify Learn</a><div class="note">Free for a limited time — join to keep every week.</div>' : '')
    + '</body></html>';
}

module.exports = async (req, res) => {
  const token = String((req.query && req.query.token) || '').slice(0, 64);
  // Short edge cache: share content/availability changes fast (expiry,
  // new versions). WhatsApp keeps its own copy per message — new links
  // always unfurl fresh.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  if (!token) {
    res.status(400).send(page({ title: 'Unify Learn', desc: 'Shared note', image: APP_URL + '/og-image.png', body: '', appLink: APP_URL + '/auth' }));
    return;
  }
  let data = null;
  let status = 0;
  try {
    const r = await fetch(API_URL + '/v1/share/' + encodeURIComponent(token));
    status = r.status;
    if (r.ok) data = await r.json();
  } catch {
    status = 0;
  }
  if (!data) {
    const expired = status === 410;
    res.status(expired ? 410 : 404).send(page({
      title: expired ? 'This Unify link expired — Unify Learn' : 'Link not found — Unify Learn',
      desc: expired ? 'Shared notes live for a while. Join free and the library stays open.' : 'This share link is invalid or was revoked.',
      image: APP_URL + '/og-image.png',
      body: '<div class="card"><div class="eyebrow">Unify Learn</div><h1>' + (expired ? 'This link expired' : 'Link not found') + '</h1><div class="sub">Shared notes live for a while — that is what makes them special.</div></div>',
      appLink: APP_URL + '/auth',
    }));
    return;
  }
  const topics = (data.note_json && Array.isArray(data.note_json.topics)) ? data.note_json.topics : [];
  const names = topics.slice(0, 5).map((t) => esc(t.title || ('Topic ' + t.number)));
  // Per-link card: the actual note authors (contributors AND lecturers —
  // whoever published these topics), not a generic brand line.
  const byline = Array.isArray(data.authors) && data.authors.length
    ? ' by ' + data.authors.slice(0, 3).map((a) => esc(a)).join(', ')
    : '';
  const title = data.course + ' · Week ' + data.week + ' on Unify Learn';
  const desc = (data.title || ('Week ' + data.week)) + ' — ' + topics.length + ' topics' + byline + ', free for ' + countdown(data.share.expires_at) + '.';
  const body = '<div class="card"><div class="eyebrow">' + esc(data.course) + ' · SHARED NOTE</div><h1>Week '
    + data.week + ': ' + esc(data.title || '') + '</h1>'
    + (data.subtitle ? '<div class="sub">' + esc(data.subtitle) + '</div>' : '')
    + (byline ? '<div class="sub">By' + byline + '</div>' : '')
    + '<div class="meta"><span class="chip">' + topics.length + ' topics</span><span class="chip">Free for ' + esc(countdown(data.share.expires_at)) + '</span><span class="chip">+' + (topics.length * 10) + ' XP inside</span></div></div>'
    + (names.length ? '<ol class="topics">' + names.map((n) => '<li>' + n + '</li>').join('') + '</ol>' : '');
  res.status(200).send(page({
    title,
    desc,
    image: APP_URL + '/og-image.png',
    body,
    appLink: APP_URL + '/s/' + encodeURIComponent(token),
  }));
};
