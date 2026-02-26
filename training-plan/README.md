# Training Plan Web App

Mobile-first training plan portal with a trainer-side publisher.

## Live URLs
- Client directory: `https://akeath18.github.io/HPE-assets/training-plan/`
- Trainer portal: `https://akeath18.github.io/HPE-assets/training-plan/trainer.html`

## Client view
- Shows one plan per share link using `?client=<client-id>`.
- Mirrors your template sections: profile, goals, weekly sessions, check-ins, and final assessment.
- Installable on mobile (PWA behavior).

## Trainer view
The trainer portal allows you to:
- Select/add/remove clients.
- Edit key fields quickly.
- Edit full client JSON directly.
- Save draft changes in-browser.
- Publish updates to GitHub (commits to `training-plan/data/training-plans.json`).
- Share direct client links immediately.

## Trainer publish setup
In `trainer.html`, set:
- `GitHub Owner`: `akeath18`
- `Repository`: `HPE-assets`
- `Branch`: `main`
- `File Path`: `training-plan/data/training-plans.json`
- `GitHub Token`: a PAT with repo write access

After pressing **Publish Update to GitHub**, GitHub Pages usually reflects updates within about 1 minute.

## Local preview
From the repo root:

```bash
cd training-plan
python3 -m http.server 8080
```

Open:
- `http://localhost:8080/`
- `http://localhost:8080/trainer.html`

## Data file
Primary source of truth:
- `training-plan/data/training-plans.json`
