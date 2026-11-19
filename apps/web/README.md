# Unify Learn: web app

The student and author frontend. Vite 5, React 18, TypeScript 5, React Router 6. Deploys to Vercel from `DIBBLS/Unify`, a frontend-only mirror of the main monorepo (see the root `README.md`).

## Scripts

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # tsc + vite build -> dist/ (also stamps the build id, see "Self-updating")
npm run preview   # serve dist/ locally (used by the browser tests)
```

## Environment

Plain names work; `VITE_` equivalents do too. Public fallbacks are built in so local dev runs with nothing set.

| Key | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL (Auth) |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. Public by design |
| `API_URL` | API base URL, no trailing slash |
| `USE_BACKEND` | `1` |
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key; must match the API's pair |

## Structure

```
src/
  routes/        one file per screen (lazy-loaded except Home, Courses, Course, Learn, Auth, Me)
    admin.tsx, admin/   admin hub; admin/performance.tsx (live metrics), admin/updates.tsx (Home slider), admin/content.tsx
    studio/      index.tsx (flow), NoteBuilder.tsx (sectioned editing, equation overlay), Pipeline.tsx
  components/    shared UI; redesign/ holds the design-system pieces (HomeHero, UpdatesSlider, brand, ui)
  lib/           api (typed client), supabase (per-tab sessions), push + pushHelp (notification permission help),
                 image (photo prep), autoUpdate (PWA updates), katex (on-demand math), offline (write queue),
                 cgpa (strict validation + planner math), vitals (Web Vitals), qrscan, naija (greetings, proverbs, facts),
                 dialog (askConfirm / askText: the app's own dialogs), features (switches for hidden features),
                 wordgame + crossword + dailyword (game terms from the notes, Term of the Day), openLink (where a
                 notification's link goes), reminders
  styles/redesign/   tokens.css, ui.css (buttons, chips), motion.css (all animation), african.css, boxboy-motion.css
public/          sw.js (offline + cache), manifest.json, icons/, boxboy/ (mascot poses)
```

## Conventions

- **One loading look.** Page-level waits use the skeletons in `components/Skeletons.tsx` (they mirror the real screen); a wait inside a page uses `SectionSkeleton`; route-level waits (auth gate, lazy chunk) use `Loading`. All end with a rotating `LoadingQuote`. Do not add ad-hoc spinners.
- **Buttons.** Only the main action is coloured (amber, green or dark). Everything else reads in the normal text colour (`ui.css` enforces this for inline-styled buttons too). Full-width buttons cap at 380px on desktop.
- **Bars and sliders** are Duolingo-style: use `ProgressBar` / `StepBars` (`components/redesign/ui.tsx`) or `components/Slider.tsx`, never a plain thin bar or a native range input.
- **Motion.** Soft and quiet: fades, a slow "breathe" on mascots and the logo dot. `backwards` fill mode, never `both`, so finished animations do not trap popups under the nav. Everything collapses under `prefers-reduced-motion`.
- **Layers.** nav 50, modal veil 120, equation overlay 125, Drop panels 130, toasts 140.
- **Pictures.** Profile photos and attendance selfies go through `lib/image.ts` (square crop, upright, white behind transparency, under 60 to 70 KB).
- **CGPA.** Always use `validateCGPA` and `cleanCgpaInput` from `lib/cgpa.ts`; a CGPA is 0.00 to 5.00 with at most two decimals.
- **Selectors** use the `Drop` overlay, never a native `<select>` (the admin phone section picker is the one deliberate exception).
- **Confirmations and prompts** use `askConfirm` / `askText` from `lib/dialog.tsx` (rendered by `<DialogHost />` in `App.tsx`), or `ConfirmModal` directly. Never `window.confirm`, `window.prompt` or `window.alert`.
- **Hidden features** are switches in `lib/features.ts` (`CGPA_TARGET`, `LEADERBOARD`), not deleted code.
- **Main buttons stay on screen** in onboarding: wrap them in the `STICKY` bar from `components/redesign/ui.tsx`.
- **Naming.** The app is "Unify Learn" in every piece of text people see, never "Unify" on its own. No hard-coded counts ("3 questions") unless the activity really has them.
- **Hooks** live above early returns.

## Self-updating PWA

`vite.config.ts` gives every build an id, stamps it into `dist/sw.js`, and writes `dist/version.json`. `lib/autoUpdate.ts` checks on launch, on return to the app, on reconnect and every 2 minutes; when a newer build exists it reloads onto it (waiting if the person is typing). The worker's cache name includes the build id, so the previous build's cache is deleted on activation. Saved weeks (offline content) are kept. Hosting must serve `/sw.js` and `/version.json` with no-cache headers (both `vercel.json` files do).

## Routes

| Route | Who | What |
|---|---|---|
| `/auth`, `/welcome` | public | Sign in or up, intro slides |
| `/onboarding` | signed in | Role-first setup |
| `/home` | signed in | Greeting, streak screen (first open of the day), class rep tools, live wire, Term of the Day, updates slider, courses |
| `/courses`, `/courses/find`, `/courses/:code`, `/learn/:code/week/:n` | student | Courses, the course page and the reader |
| `/courses/:code/lecturers` | class rep | Set a course's lecturers, their weeks and the course introduction |
| `/timetable` | signed in | Class times and My own (personal entries only you see) |
| `/class`, `/hoc` | student | Class board: live wire, announcements, polls, questions; class rep posting and questions waiting |
| `/hoc/rules`, `/class-list` | class rep | Class rules (confirm reminders, lecturer cancel cut-off); the class list |
| `/games`, `/games/daily`, `/learn/:code/week/:n/keywords`, `…/crossword` | student | Course games and Term of the Day |
| `/streak` | student | Your streak over five weeks |
| `/attendance/pass`, `/attendance/my` | student | My pass (QR that changes every 30 s, opened from the week); my record |
| `/attendance/scanner`, `/lecturer`, `/my-classes` | lecturer, class rep | Rotating QR, roster with photos, materials |
| `/cgpa-planner` | student | Current CGPA, target, course status, roadmap |
| `/studio`, `/browse` | author | Write, publish, browse notes |
| `/admin`, `/admin/:section` | admin | The hub |
| `/s/:token` | public | Expiring share link |
| `/notifications`, `/me` | signed in | Bell, profile |

## Browser tests

The Puppeteer suites that drive these screens against a stubbed API are not yet in the repo. See `docs/PRODUCTION-READINESS.md` for the plan to move them into CI.
