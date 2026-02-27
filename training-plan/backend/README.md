# Training Plan Backend

Secure approval backend for student plan submissions.

## What it does
- Receives student edits from `trainer.html`.
- Stores them as pending requests.
- Lets coaches approve/reject in `coach-review.html`.
- On approve, updates `training-plan/data/training-plans.json` in GitHub and publishes live.

## Endpoints
- `POST /api/submissions` (student submit)
- `GET /api/submissions/pending` (coach)
- `POST /api/submissions/:id/approve` (coach)
- `POST /api/submissions/:id/reject` (coach)
- `GET /health`

## Environment
Copy `.env.example` to your hosting provider env vars:
- `COACH_REVIEW_KEY` = secret coach key
- `GITHUB_TOKEN` = GitHub token with write access to repo contents
- `GITHUB_OWNER` = `akeath18`
- `GITHUB_REPO` = `HPE-assets`
- `GITHUB_BRANCH` = `main`
- `GITHUB_FILE_PATH` = `training-plan/data/training-plans.json`
- `ALLOWED_ORIGINS` = `https://akeath18.github.io`

## Local run
```bash
cd training-plan/backend
npm install
npm start
```

Runs on `http://localhost:8787` by default.

## Frontend connection
Set `training-plan/api-config.js`:
```js
window.PLAN_API_BASE = "https://your-backend-domain.example.com";
```
