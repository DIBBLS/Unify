# Unify Backend Setup (Supabase + Prisma + Render + Vercel)

Backend code is already in the repo (`notes-engine` combined server).
**Yes — Render runs Prisma on Supabase for you**: every Render build executes
`prisma generate && prisma migrate deploy && npm run build`, so the database
migrates itself on each deploy. You just supply the connection strings.

## 1. Supabase (~8 min)

1. Go to https://supabase.com → **New project**. Name `unify`, save the DB password.
2. **Project Settings → Database → Connection string**: you need two URIs
   (replace `[YOUR-PASSWORD]` with the DB password from step 1):
   - **Pooler** (port `6543`, Transaction mode) → `DATABASE_URL` (app traffic)
   - **Direct** (port `5432`) → `DIRECT_URL` (`prisma migrate deploy` only)
3. **Project Settings → API**: copy `Project URL` (`SUPABASE_URL`), `anon` key
   (`SUPABASE_ANON_KEY`), `service_role` key (`SUPABASE_SERVICE_ROLE_KEY`, backend only).
4. **Authentication → Providers → Google → Enable**:
   - Google Cloud Console → Credentials → OAuth client (Web) → add redirect
     `https://xyzcompany.supabase.co/auth/v1/callback` (your project ref).
   - Supabase → **Authentication → URL Configuration** → Redirect URLs +=
     `https://your-app.vercel.app/**`.
5. **Schema — pick ONE path:**
   - **A (recommended, automatic):** do nothing. Render applies
     `notes-engine/prisma/migrations/0001_init` on first deploy. Then run
     `supabase/seed.sql` once in **SQL Editor** for LASU + MEE 352 Week 1.
   - **B (manual):** run `supabase/schema.sql` then `supabase/seed.sql` in SQL
     Editor, and after the first Render deploy baseline Prisma so it doesn't
     re-apply: `npx prisma migrate resolve --applied 0001_init` (needs
     `DATABASE_URL`/`DIRECT_URL` locally).

## 2. Render (~5 min)

1. Dashboard → **New → Blueprint** → select the `Unify` repo (`render.yaml`).
2. Fill env vars:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`, `DIRECT_URL` (from step 1.2)
   - `CORS_ORIGIN` → exact Vercel URL, e.g. `https://your-app.vercel.app`
   - `ANTHROPIC_API_KEY` → skip unless using note authoring
3. **Deploy** (~3-5 min first build: install → prisma generate → migrate deploy → build).
   Watch the logs for `prisma migrate deploy` applying `0001_init`.
4. Verify: `https://unify-api.onrender.com/healthz` →
   `{"ok":true,"service":"unify-api"}`. First hit after idle takes 30-60s
   (free tier sleeps) — normal; the app warms it up and retries.

## 3. Vercel (~3 min)

Settings → Environment Variables (Production + Preview):

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | step 1.3 |
| `VITE_SUPABASE_ANON_KEY` | step 1.3 |
| `VITE_API_URL` | Render URL, no trailing slash |
| `VITE_USE_BACKEND` | `0` for now (current Firebase flow while testing) |

**Redeploy** so env vars bake in.

## 4. Flip the cutover (together, when ready)

1. Test users re-register via Supabase Google sign-in (fresh seed — Firebase accounts don't carry over).
2. `VITE_USE_BACKEND=1` → redeploy → test sign-in → onboarding → dashboard → week content.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Cold start slow/fails once, then works | Free-tier sleep. App retries; open `/healthz` once to wake. |
| `CORS error` | `CORS_ORIGIN` must exactly match the Vercel URL. |
| `401 Invalid session` | Google provider off, or user signed in via Firebase after cutover. |
| Prisma `P1001 can't reach DB` on Render | Wrong password/port in `DIRECT_URL` — must be `:5432` direct, not pooler. |
| Prisma tries to re-create existing tables | You used path B already — run the baseline command from 1.5. |
| `/v1/universities` returns `[]` | Seed not run yet — run `supabase/seed.sql` (onboarding still works via LASU fallback). |
