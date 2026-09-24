# Unify Learn — Web App

The student + author frontend. Vite 5 + React 18 + TypeScript 5 + React Router 6.
Deploys to Vercel from `DIBBLS/Unify` (frontend-only mirror of the main monorepo).

## Stack

Single font (Nunito), emerald theme, 1px flat cards, lucide icons, KaTeX math,
SVG Box Boy mascot. Zero `localStorage` — all state lives server-side
(Supabase Auth session excepted). Mobile-first 480px shell, safe-area aware.

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

Built-in public fallbacks keep local dev working; env vars override.

## Routes

| Route | Who | What |
|---|---|---|
| `/auth` | public | Sign in/up, typed welcome, welcome-back splash |
| `/onboarding` | signed in | Role-first setup (collaborator 2 / lecturer 5 / student 7 steps) |
| `/dashboard` | signed in | Student stats + courses, or author Published notes |
| `/course` | student | Level-filtered catalog |
| `/course/:code`, `/learn/:code/week/:week` | student | Week list, tabbed topics + EOQ quiz, Save PDF |
| `/profile` | signed in | Details, email change, Studio entry (authors), logout |
| `/studio` | lecturer/collaborator/admin | Author wizard: paste → review → publish |
| `/admin` | admin | Stats, AI models, universities, courses, users/invites |
| `*` | public | Mascot 404 with nav links |

## Backend

All data flows through the Render API (`src/lib/api.ts`): profiles, onboarding,
weeks (`noteJson`), progress/XP/streaks, quiz attempts, publish, admin.
See root `SETUP.md` for the full backend guide.
