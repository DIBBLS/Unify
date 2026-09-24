# Unify Learn

Student learning platform for LASU Engineering — guided 12-week paths, XP, streaks, quizzes, PDF export, and an authoring studio for lecturers and collaborators. Minimal emerald UI, mobile-first, Box Boy mascot.

## Architecture

```
Browser ──HTTPS──▶ Vercel (Unify Learn app) ──HTTPS──▶ Render (Unify API) ──▶ Supabase (Postgres + Auth)
                          ▲                                ▲                        ▲
                     DIBBLS/Unify                    knight-dev01/Unify      shared project
                     (frontend only)                 (full monorepo)
```

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Web app | **Vite 5 + React 18 + TypeScript 5 + React Router 6** (`apps/web`) | 480px shell, Nunito, emerald tokens, lucide icons, KaTeX formulas, SVG mascot |
| API + authoring | **Express 4 + TypeScript** (`notes-engine/`) | `/v1/*` app API + `/api/*` authoring, zod validation, rate limits, JSON logs |
| Data + Auth | **Supabase** (Postgres + Auth) | RLS locked down; backend uses service role; Prisma `migrate deploy` on Render |
| AI notes | **Gemini** (default) / Anthropic (opt-in) | Studio-only `/api/convert`; model registry with health-tracked rotation; students never touch AI |
| Hosting | **Vercel** (web, static) + **Render** free tier (API, Blueprint) | SPA fallback rewrites; `/healthz`; 12-min keep-alive cron |
| CI | GitHub Actions (keep-alive) + `Sync-Frontend.ps1` | Frontend-only mirror `fork → DIBBLS/Unify`; **never merge upstream → fork** |

## Monorepo Structure

```
Unify/
├── apps/web/                  # Unify Learn app (deploys to Vercel from DIBBLS/Unify)
│   ├── src/
│   │   ├── routes/            # auth, onboarding (role-first), dashboard, course,
│   │   │                      # learn/week (tabs + quiz), profile, admin, studio
│   │   ├── components/        # Mascot, Flash, Loading, MiniCheck, TopicSlice,
│   │   │                      # ContentBlock, Formula (KaTeX), EoqQuiz, BackButton
│   │   ├── hooks/useProgress.ts  # server-backed topic progress (no localStorage)
│   │   ├── lib/               # supabase (Auth), api (backend client), log
│   │   └── types/note.ts      # UnifyNote schema (topics, miniCheck, pulse, EOQ)
│   ├── public/                # 404.html, manifest, sw.js (offline), og-image.png
│   └── package.json, vite.config.ts (plain env names work, VITE_ optional)
├── notes-engine/              # Unify API (deploys to Render from fork)
│   ├── server.ts              # routes, CORS, logging, trust proxy, JSON 404
│   ├── src/routes/v1.ts       # universities, me, onboarding, courses, weeks,
│   │                          # progress, stats, publish, authored, admin/*
│   ├── src/lib/               # supabase, ai (provider adapter + registry), seed
│   ├── src/middleware/        # requireAuth, requireAuthor, requireAdmin, logger
│   ├── prisma/                # schema + migrations (auto-applied on Render)
│   └── scripts/               # check-env (preflight), copy-js (build)
├── supabase/                  # schema.sql + seed.sql (reference; Prisma owns DDL)
├── docs/                      # PRD specs (reference)
├── render.yaml                # Render Blueprint (fork)
├── vercel.json                # Vercel build + SPA fallback + redirects
├── SETUP.md                   # backend setup guide (Supabase + Render + Vercel)
└── scripts/                   # Sync-Frontend.ps1 (frontend-only upstream sync)
```

## Quick Start

```bash
git clone https://github.com/knight-dev01/Unify.git
cd Unify

# Web app
cd apps/web
npm install
npm run dev      # http://localhost:3000

# API (separate shell)
cd ../../notes-engine
npm install
npm run dev      # tsx watch server.ts — needs SUPABASE_* + DIRECT_URL in .env
```

## Deploy

- **Web (Vercel, `DIBBLS/Unify`)**: Root Directory `.`, build/output/install from `vercel.json`, env `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `API_URL`, `USE_BACKEND=1` → Redeploy. Auto-deploys on push (manual sync script or bot).
- **API (Render, fork)**: New → Blueprint → `render.yaml` → env `SUPABASE_*`, `DATABASE_URL` (`:6543`), `DIRECT_URL` (`:5432`), `CORS_ORIGIN`, `ADMIN_EMAILS`, `AI_PROVIDER=gemini`, `GEMINI_API_KEY` → Deploy. Migrations + reference seed run automatically.
- **First admin**: sign in as `unify.admin@unify.learn` / `unify.admin` (auto-seeded, pre-confirmed) → rotate the password immediately.

## Roles & Flows

- **Student** (7 onboarding steps): dashboard (XP/streak/quizzes) → level catalog → 12 weeks → topics + EOQ quiz → PDF export.
- **Lecturer** (5 steps: role → name → uni → faculty → dept): Studio (convert → review → publish), Published-notes dashboard. No Learn paths.
- **Collaborator** (2 steps: role → name): same author tooling (internal or external).
- **Admin** (`/admin`): stats, model registry health, universities, courses-per-level, users/roles/invites. Bootstrap via `ADMIN_EMAILS`.
- Roles lock at assignment (server-enforced 403); profile edits name/email only.

## Docs

- `SETUP.md` — full Supabase + Render + Vercel setup, env tables, troubleshooting.
- `docs/` — product specs. `supabase/` — reference SQL (Prisma migrations are authoritative).

## License

© 2026 Unify Learn
