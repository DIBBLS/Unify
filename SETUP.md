# Unify Backend Setup (Supabase + Render + Vercel)

Backend code is already in the repo (`notes-engine` combined server, commit `d3de61f`).
You do the 3 console setups below — about 20 minutes, all free tier.

## 1. Supabase (~8 min)

1. Go to https://supabase.com → **New project**. Name `unify`, any region close to you, generate a DB password (save it).
2. Wait for provisioning → left menu **SQL Editor** → **New query**:
   - Paste the full contents of `supabase/schema.sql` → **Run**.
   - New query → paste `supabase/seed.sql` → **Run**.
3. **Project Settings (gear icon) → API**: copy these 3 values:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY` (never put this in the frontend)
4. **Authentication → Providers → Google → Enable**:
   - Needs a Google Cloud OAuth client ID/secret (Google Cloud Console → APIs & Services → Credentials → Create OAuth client → Web application).
   - Authorized redirect URI to add in Google Cloud: `https://xyzcompany.supabase.co/auth/v1/callback` (replace `xyzcompany` with your project ref).
   - Back in Supabase → **Authentication → URL Configuration** → add your Vercel URL to **Redirect URLs**, e.g. `https://your-app.vercel.app/**`.

## 2. Render (~5 min)

1. https://dashboard.render.com → **New → Blueprint** → connect/select the `Unify` repo. It reads `render.yaml` (service `unify-api`, free plan, health check `/healthz`).
2. On the deploy screen fill the secrets:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from step 1.3)
   - `CORS_ORIGIN` → your exact Vercel URL, e.g. `https://your-app.vercel.app` (no trailing slash)
   - `ANTHROPIC_API_KEY` → skip unless you use note authoring (`/api/convert`)
3. **Deploy**. First build takes ~3-5 min. Note your service URL: `https://unify-api.onrender.com` (name may differ).
4. Verify in browser: `https://unify-api.onrender.com/healthz` → expect `{"ok":true,"service":"unify-api"}`.
   First hit after idle can take 30-60s (free tier sleeps) — that is normal; the app warms it up and retries.

## 3. Vercel (~3 min)

Project → **Settings → Environment Variables** → add (Production + Preview):

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | from step 1.3 |
| `VITE_SUPABASE_ANON_KEY` | from step 1.3 |
| `VITE_API_URL` | your Render URL, e.g. `https://unify-api.onrender.com` (no trailing slash) |
| `VITE_USE_BACKEND` | `0` for now (keeps current Firebase flow while testing) |

**Redeploy** (Deployments → ⋯ → Redeploy) so the new env vars bake in.

## 4. Flip the cutover (do together when ready)

1. Supabase Auth users re-register (fresh seed — old Firebase test accounts do not carry over, per plan).
2. Set `VITE_USE_BACKEND=1` in Vercel → redeploy.
3. Test: sign in with Google → onboarding (LASU fallback guaranteed even before seed check) → dashboard → week content from `weeks.note_json`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| First API call slow/fails, then works | Free-tier cold start. App retries once; if still failing, open `/healthz` once to wake it. |
| `CORS error` in browser console | `CORS_ORIGIN` on Render must exactly match your Vercel URL (scheme + domain, no path). |
| `401 Invalid session` | Supabase Auth not configured or Google provider off; user must sign in via Supabase (not Firebase) after cutover. |
| `/v1/universities` returns `[]` | `seed.sql` wasn't run. Run it, or onboarding still works via the LASU fallback. |
| Render build fails on `tsc` | Paste me the log. Local `tsc --noEmit` is clean, so this would be an env issue (e.g. Node version — blueprint pins 20). |
