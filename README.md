# Unify

Student academic platform for LASU Engineering — Duolingo-style Learn, CGPA, timetable, profile. Lean rebuild focus: `Home → Course (lecturer card) → 12 weeks → Class 1/2/3 → Note (scoped AI)` per `docs/PRD-lean-v1.0.docx`.

## Stack (lean, minimalistic — Vite+React+TS, Express+TS)

| Layer | Tech | Why |
|-------|------|-----|
| Web (Duolingo Learn) | **Vite 5 + React 18 + TypeScript 5 + React Router 6** in `apps/web` | Flexible hiring (React), fast HMR, Svelte-level LCP via Vite islands for `MiniCheck`, lean `480px` Duolingo shell |
| Notes Engine (authoring) | **Express 4 + TypeScript** in `notes-engine/` | Extends existing `server.js` (`POST /api/convert` Claude → `noteJson`), `tsx watch`, no rewrite |
| Data | **Firebase** Auth + Firestore `courseContent/{course-week}.noteJson` | `js/firebase-config.js` single source, `apps/web/src/lib/firebase.ts` re-export |
| Styling | `css/variables.css` tokens, `DM Sans` + `Playfair Display` | Shared `apps/web/src/index.css` |
| Hosting | **Vercel** | Root static `vercel.json` `framework:vite`, `notes-engine` as serverless `/api/*` |

Master spec: `docs/PRD-master-v5.0.docx` (deferred P2: Arcade/Coins/WhatsApp). Lean P0 only here.

## Monorepo Structure

```
Unify/
├── apps/
│   ├── web/                          # Vite+React TS — lean Learn
│   │   ├── src/
│   │   │   ├── pages/                # CoursePage (12 weeks) → LearnPage (Week→TopicSlice)
│   │   │   ├── components/           # ContentBlock, MiniCheck, TopicSlice
│   │   │   ├── hooks/                # useProgress (topicKey w_t, localStorage + Firestore)
│   │   │   ├── lib/firebase.ts       # re-export js/firebase-config.js
│   │   │   ├── types/note.ts         # UnifyNote (topics[].subtopics[].miniCheck/pulseCheck/eoq)
│   │   │   ├── App.tsx               # BrowserRouter /course, /learn/:courseCode/week/:week
│   │   │   └── index.css             # --green/#22C55E tokens
│   │   ├── public/icons, manifest.json, sw.js
│   │   ├── package.json, vite.config.ts, tsconfig.json
│   │   └── index.html
│   └── notes-engine/                 # Express+TS — Draft→AI→Review→Published
│       ├── server.ts                 # (from server.js) /api/convert|validate|render|save|upload
│       ├── src/{renderer.ts,schema.ts}, samples/hand_authored_note.json
│       ├── package.json (tsx, @types/*), tsconfig.json
│       └── public/app.js             # admin authoring UI
├── docs/
│   ├── PRD-lean-v1.0.docx
│   └── PRD-master-v5.0.docx
├── js/                               # legacy Firebase+roles (re-exported)
├── css/                              # legacy tokens (reference)
├── Coursecontents/                   # legacy per-week HTML (migrating to noteJson)
├── Learn.html, dashboard.html, ...   # legacy static (kept for reference, new is apps/web)
├── vercel.json, vite.config.js       # root legacy (new web has own vite.config.ts)
└── firestore.rules
```

## Quick Start

```bash
git clone https://github.com/DIBBLS/Unify.git
cd Unify

# Web (lean Learn)
cd apps/web
npm install
npm run dev      # http://localhost:3000  (or 5173 if root)

# Notes Engine (authoring)
cd ../../notes-engine
npm install
npm run dev      # http://localhost:3000 (tsx watch server.ts) — set ANTHROPIC_API_KEY in .env
```

Legacy static (no build): `npx serve .` then open `Learn.html`.

## Vercel Deploy

- **Web:** Vercel → Import `DIBBLS/Unify` → Framework `Vite` → Root `apps/web` or `.` with `vercel.json` `framework:vite` `outputDirectory: apps/web/dist` (static). Auto-deploy on `push to main`.
- **Notes Engine:** Separate Vercel project from `notes-engine/` with `@vercel/node` or same monorepo rewrite `/api/*` → `notes-engine/api`.

```bash
firebase deploy --only firestore:rules
```

## Lean P0 Scope

- ✅ Course card (lecturer bio) → 12 weeks → Class → Note + `MiniCheck` per subtopic (`ContentBlock` types: paragraph/bullets/formula/symbol/insight/analogy/workedExample/diagram)
- ✅ `noteJson` in Firestore (not `htmlContent` string), `TopicSlice` shadow-free React
- ⏳ Scoped AI per note (stub `showToast`) → `POST /api/convert` `SYSTEM_PROMPT`
- ⏳ Flexible gating (default free next week, lecturer toggle)
- ⏳ Lecturer dashboard same web (`dashboard.html` per-week completion)

Deferred `P2`: Arcade, Coins, peer stakes, WhatsApp, multi-uni.

## License

© 2025 Unify
