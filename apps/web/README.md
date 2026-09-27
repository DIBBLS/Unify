# Unify Learn — Web App

Student + author frontend. Vite 5 + React 18 + TypeScript 5 + React Router 6.
Deploys to Vercel from `DIBBLS/Unify` (frontend-only mirror of the main monorepo).

## Stack

Classic/Story designs + dark mode (CSS tokens, per-device), Playfair Display +
DM Sans + Nunito, emerald theme, 1px flat cards, lucide icons, KaTeX math,
SVG Box Boy mascot, Web Push, offline worker. Device prefs (theme, design,
role hint, push prompt) in `localStorage`; everything else server-side.

## Scripts

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # tsc + vite build -> dist/
npm run preview
```

## Env (plain names work; `VITE_` equivalents too)

| Key | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL (Auth) |
| `SUPABASE_PUBLISHABLE_KEY` | anon key (Auth; public-safe) |
| `API_URL` | Render backend URL, no trailing slash |
| `USE_BACKEND` | `1` (backend is the source of truth) |
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key (fallback baked into `src/lib/push.ts`) |

Built-in public fallbacks keep local dev working; env vars override.

## Routes

| Route | Who | What |
|---|---|---|
| `/auth` | public | Sign in/up, forgot-password, welcome-back splash |
| `/onboarding` | signed in | Role-first setup (student 8 / lecturer 6 / collaborator 3 steps) |
| `/dashboard` | signed in | Students: XP/streak/resume/courses; authors: notes/courses stats; admins: oversight card |
| `/course` | student | My Courses (bulk week counts) |
| `/explore` | student | Enroll-only catalog (single bulk call) |
| `/course/:code`, `/learn/:code/week/:week` | student (+preview roles) | Story reader: hero, segmented chapters, recalls, read-aloud, EOQ exam, share, XP-gated PDF |
| `/s/:token` | public | Expiring share landing with preview card + join CTA |
| `/browse` | lecturer/collaborator | Level-scoped note browser (read-only previews) |
| `/notifications` | signed in | Bell list, auto-opens on fresh entry when unread |
| `/profile` | signed in | Inline edit, email change, appearance (design/theme/push), version footer |
| `/studio` | lecturer/collaborator/admin | AI / manual / external-AI authoring, versioned publish |
| `/admin`, `/admin/content` | admin | Modules (analytics, models, unis, courses, session, announce, users), all-content tree |
| `*` | public | Mascot 404 with nav links |

## Key client rules

- XP/progress/quiz recording is students-only (server-enforced); staff reads record nothing.
- Learning paths are students-only; authors/admins use `?preview=1` (read-only, no resume/XP).
- 30-min sliding idle TTL (persisted), Remember-me opt-in, exact resume for students.
- Zero `window.confirm` — all confirmations use the designed `ConfirmModal`.
- Hooks live above early returns (error #310 guard — see git history).

## Backend

All data flows through the Render API (`src/lib/api.ts`). See root `SETUP.md`.
