# Training Plan Web App

Mobile-first training plan portal with a simple no-JSON plan editor.

## Live URLs
- Client directory: `https://akeath18.github.io/HPE-assets/training-plan/`
- Plan editor: `https://akeath18.github.io/HPE-assets/training-plan/trainer.html`

## Client view
- Shows one plan per share link using `?client=<client-id>`.
- Mirrors your template sections: profile, goals, weekly sessions, check-ins, and final assessment.
- Installable on mobile (PWA behavior).

## Plan editor (student-friendly)
The plan editor allows users to:
- Pick a student and update the plan using normal form fields.
- Edit week-by-week sessions and exercise rows directly.
- Update check-ins and final assessment rows.
- Share the student plan link instantly.
- Post updates live with one button: **Post Updates Live**.

## Posting updates
The editor only asks for one field:
- `Publishing Key`: coach key used to post changes live.

No JSON editor, repo, branch, or file-path setup is shown in the UI.

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
