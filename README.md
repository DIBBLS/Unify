# Unify

**Student academic platform for LASU Engineering students.**

Unify helps students track their academic progress, manage timetables, access course content, and build a professional portfolio — all in one place.

## Features

- **CGPA Dashboard** — Track your cumulative GPA with semester-by-semester breakdowns
- **CGPA Predictor** — Plan ahead and predict your final GPA
- **Timetable** — Weekly class schedule with notification support
- **Learning Library** — Week-by-week course content for all engineering courses
- **Student Profile** — Showcase projects, skills, and build your academic portfolio
- **Admin Panel** — Course and content management for class reps and admins

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (no framework) |
| Backend | Firebase (Auth, Firestore) |
| Hosting | Netlify |
| Fonts | Playfair Display, DM Sans (Google Fonts) |

## Getting Started

No build step required. This is a pure static site.

1. Clone the repo:
   ```bash
   git clone https://github.com/DIBBLS/Unify.git
   cd Unify
   ```

2. Open any `.html` file in your browser, or run a local server:
   ```bash
   npx serve .
   ```

3. Start at `Auth.html` to sign in, or `dashboard.html` for the main hub.

## Project Structure

```
Unify/
├── index.html          # Profile + social feed
├── dashboard.html      # Main hub — CGPA, courses, study planner
├── Auth.html           # Sign in / Sign up
├── Onboarding.html     # First-time user setup
├── Learn.html          # Course learning browser
├── timetable.html      # Weekly timetable
├── predictor.html      # CGPA predictor tool
├── profile.html        # Extended profile with tabs
├── Admin.html          # Admin panel
├── css/                # Shared stylesheets
│   ├── variables.css   # Design tokens
│   ├── base.css        # Reset & global styles
│   ├── components.css  # Reusable UI components
│   ├── responsive.css  # Media queries
│   └── pages/          # Page-specific styles
├── js/                 # Shared JavaScript
│   ├── firebase-config.js  # Firebase initialization
│   ├── theme.js        # Dark/light mode toggle
│   ├── roles.js        # User role helpers
│   └── pages/          # Page-specific logic
├── courses.js          # Course database (Engineering)
├── course2.js          # Course database (Environmental Science)
├── Coursecontent.JS    # 12-week topic structures per course
├── Coursecontents/      # Rich HTML study pages (per course, per week)
├── firestore.rules     # Firestore security rules
└── netlify.toml        # Deployment configuration
```

## Deployment

This site deploys automatically to Netlify on push to `main`.

To deploy Firestore rules:
```bash
firebase deploy --only firestore:rules
```

## License

© 2025 Unify. All rights reserved.