# Unify Learn — v1.8.0

Student learning platform for LASU Engineering — story-like weekly notes, XP, streaks, quizzes, read-aloud with Nigerian voice pick, expiring share links, XP-gated PDF, and an authoring studio for lecturers and collaborators. Classic/Story designs + dark mode, mobile-first, Box Boy mascot.

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
| Web app | **Vite 5 + React 18 + TypeScript 5 + React Router 6** (`apps/web`) | 480px shell, Classic/Story designs + dark mode, lucide icons, KaTeX formulas, SVG mascot, Web Push, offline worker |
| API + authoring | **Express 4 + TypeScript** (`notes-engine/`) | `/v1/*` app API + `/api/*` authoring + `/api/share/*` OG unfurls, zod validation, rate limits, JSON logs |
| Data + Auth | **Supabase** (Postgres + Auth) | RLS locked down; backend uses service role; Prisma `migrate deploy` on Render |
| AI notes | **Gemini** (default) / Anthropic (opt-in) | Studio-only `/api/convert`; model registry with health-tracked rotation; students never touch AI |
| Hosting | **Vercel** (web, static) + **Render** free tier (API, Blueprint) | SPA fallback rewrites; `/healthz`; 12-min keep-alive cron |
| CI | GitHub Actions (keep-alive) + `Sync-Frontend.ps1` | Frontend-only mirror `fork → DIBBLS/Unify`; **never merge upstream → fork** |

## Monorepo Structure

```
Unify/
├── apps/web/                  # Unify Learn app (deploys to Vercel from DIBBLS/Unify)
│   ├── src/
│   │   ├── routes/            # auth, onboarding, dashboard, course/explore,
│   │   │                      # learn/week (story reader + EOQ exam), profile,
│   │   │                      # admin (+content browser), browse, share (/s/:token),
│   │   │                      # studio, notifications
│   │   ├── components/        # Mascot, Flash, Loading, MiniCheck, TopicSlice,
│   │   │                      # ContentBlock, Formula (KaTeX), EoqQuiz, RecallDeck,
│   │   │                      # ReadAloud, ShareModal, ConfirmModal, Charts,
│   │   │                      # ErrorBoundary, BackButton
│   │   ├── hooks/            # useProgress (server XP), useTheme, useDesign
│   │   ├── lib/               # supabase (Auth), api (backend client), log,
│   │   │                      # push (Web Push), xp (gates), version, greet
│   │   └── types/note.ts      # UnifyNote schema (topics, miniCheck, pulse, EOQ)
│   ├── public/                # 404.html, manifest, sw.js (offline), og-image.png
│   └── package.json, vite.config.ts (plain env names work, VITE_ optional)
├── notes-engine/              # Unify API (deploys to Render from fork)
│   ├── server.ts              # routes, CORS, logging, trust proxy, JSON 404
│   ├── src/routes/v1.ts       # universities, me, onboarding, courses, weeks,
│   │                          # progress (students-only XP), stats, publish,
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
- **API (Render, fork)**: New → Blueprint → `render.yaml` → env `SUPABASE_*`, `DATABASE_URL` (`:6543`), `DIRECT_URL` (`:5432`), `CORS_ORIGIN`, `ADMIN_EMAILS`, `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `BREVO_API_KEY` + `EMAIL_FROM`, `VAPID_*` (push) → Deploy. Migrations + reference seed run automatically.
- **First admin**: sign in as `unify.admin@unify.learn` / `unify.admin` (auto-seeded, pre-confirmed) → rotate the password immediately.

## Roles & Flows

- **Student** (8 onboarding steps): dashboard (XP/streak/quizzes) → My Courses + Explore (bulk catalog) → story reader (recalls, read-aloud, EOQ exam) → PDF unlocks at 300 XP.
- **Lecturer** (6 steps incl. teaching level) / **Collaborator** (3 steps incl. contributing level): Studio (AI/manual/external-AI), versioned publishing, level-scoped Browse, Notes/Courses stats. No Learn paths, no XP.
- **Admin** (`admin` role or legacy flag): oversight dashboard (totals + latest users/notes), panel modules (Analytics charts, AI models, unis, courses, session, announce, users), All-content browser. Own role self-locked. Bootstrap via `ADMIN_EMAILS`.
- Roles lock at assignment (server-enforced 403); every promote/demote notifies the recipient (bell + push).
- **Sharing (authors/admins):** expiring `/s/:token` links (8/16/24h) with preview cards + WhatsApp OG unfurls; recipients read free, join on expiry.
- **Notifications:** in-app bell + Brevo email + Web Push (VAPID, opt-in per device).
- **Sessions:** independent per-tab, Remember-me opt-in, 30-min idle TTL, exact resume for students.

## Docs

- `SETUP.md` — full Supabase + Render + Vercel setup, env tables, troubleshooting.
- `docs/unify-product-v1.6.0.pdf` (+ HTML source) — full product documentation; regenerate per release.
- `docs/` — product specs. `supabase/` — reference SQL (Prisma migrations are authoritative).

## Versioning

SemVer `MAJOR.MINOR.PATCH` (Profile footer shows it): MAJOR = platform generation, MINOR = feature batch, PATCH = bugfix push.

## License

© 2026 Unify Learn
