# Training Plan Web App

Training plans with controlled student submissions and coach approval.

## Live pages
- Client view: `https://akeath18.github.io/HPE-assets/training-plan/`
- Student plan editor: `https://akeath18.github.io/HPE-assets/training-plan/trainer.html`
- Coach review: `https://akeath18.github.io/HPE-assets/training-plan/coach-review.html`

## Security model
- Students do **not** get GitHub/repo keys.
- Students submit edits to a backend queue.
- Coaches review requests and approve/reject.
- Backend (server-side secret) publishes approved changes to GitHub.

## Required backend
GitHub Pages is static, so approval/publishing runs in `training-plan/backend`.

### Backend setup
1. Deploy `training-plan/backend` to a Node host (Render/Railway/Fly/VM).
2. Set env vars from `training-plan/backend/.env.example`.
3. Start server (`npm install && npm start`).

### Frontend connection
Set API base URL in:
- `training-plan/api-config.js`

Example:
```js
window.PLAN_API_BASE = "https://your-backend-domain.example.com";
```

## Data file
Approved updates are written to:
- `training-plan/data/training-plans.json`
