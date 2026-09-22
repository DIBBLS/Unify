# Duolingo UI Adopted — Unify Learn (100% similarity, distilled from design.duolingo.com + clones)

Source: `virgiliojr94/duolingo-ux-reference` (distilled public guidelines) + `Rajat-Raghuvanshi-0512/duolingo-clone` (Next 16, Tailwind 4, Radix) + `NickCoder123/duolingo-clone` Lingo (Next 14, RSC).

## Tokens Pulled

**Color — Owl green anchor**
- Primary `#58cc02` → `--green` (30% surface), Deep `#58a700` shadow/press, Hover `#89e219`, Pale `#dbf8c5` soft fill
- Semantic: Cardinal `#ff4b4b` wrong/life, Streak `#ff9600`, Eel Blue `#1cb0f6` hint, Gem Pink `#ce82ff`, Bee Yellow `#ffe700` (from SKILL)
- Neutral: Snow `#ffffff` bg, Eel `#f7f7f7` surface, Swan `#e5e5e5` 2px border, Wolf `#777777` secondary text, Eel Black `#3c3c3c` primary text

**Typography — Feather Bold + Mona Sans (free: Nunito)**
- Display/Hero: `Nunito 800 48-56px -0.02em` (Learn.html hero)
- Body: `Nunito 500 15px 1.5` (lesson prompt), Button `Nunito 800 16px 0.02em`
- Applied: `@import Nunito` in `apps/web/src/index.css` + `css/variables.css` `--font-display/--font-body`

**Shape & Spacing**
- Radii: `16px` cards/buttons, `12px` inputs, `9999px` pills/chips/progress (from SKILL)
- Borders: `2px solid #e5e5e5` + `4px bottom-shadow` tactile press (not box-shadow) — `topic-card`, `btn-primary`/`secondary`
- Spacing: `4,8,12,16,24,32,48` scale, container `1080px` max, 24px gutter

**Components Pulled**
- `btn-primary`: `#58cc02` + `#fff` text, `16px 14x24`, `16px radius`, `border-bottom 4px #58a700`, `active translateY 4px`, hover `#89e219`
- `btn-secondary`: `white` + `2px #e5e5e5` + `4px bottom`, hover `#afafaf`
- `card`: `white` + `2px #e5e5e5` + `4px bottom`, `16px` radius, `16px` pad
- `progress`: track `#e5e5e5` `16px` pill, fill `#58cc02`, `320ms ease-out`
- `Skill Tree Node`: `80x72` circle `50%`, `6px bottom`, pulse `1.6s` — mapped to `weekStatusCircle`/`ringWrap`
- Motion: `180ms` button press, `cubic-bezier(0.34,1.56,0.64,1)` overshoot

## Applied In
- `css/variables.css` Duolingo snow/eel + green set
- `apps/web/src/index.css` Nunito, hero, topic-card chunky shadow, mini-check left border `#58cc02`
- `css/pages/Auth.styles.css` Duolingo Auth: green left `auth-left #58cc02`, pill tabs `9999px`, inputs `12px` `2px`, `btn-submit` 56px 4px shadow
- `css/base.css` 16px mobile base + `css/responsive.css` min-width 320→768→1024 mobile-first
- `apps/web/src/routes/*` Duolingo 480px shell scales to 1080px (Learn → Course 12 weeks)
