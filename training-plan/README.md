# Training Plan Web App

Trainer-first workflow: create templates, assign/edit client plans, publish, then share client links.

## Live pages
- Client view: `https://akeath18.github.io/HPE-assets/training-plan/`
- Trainer studio: `https://akeath18.github.io/HPE-assets/training-plan/trainer.html`

## Recommended workflow
1. Open **Trainer Studio**.
2. Build or update a **Template** in Template Library.
3. Create a **New Client from Template**.
4. Edit the client plan (profile, goals, weekly sessions, final assessment).
5. Click **Publish Updates Live**.
6. Click **Share Client Link** to send the plan to the client.

Students only need their client link and never need publishing access.

## Trainer access controls
Configure in `training-plan/trainer-config.js`:
- `accessPin`: optional trainer-only page PIN
- `githubOwner`, `githubRepo`, `githubBranch`, `githubFilePath`: publish target

Example:
```js
window.TRAINER_CONFIG = {
  accessPin: "1234",
  githubOwner: "akeath18",
  githubRepo: "HPE-assets",
  githubBranch: "main",
  githubFilePath: "training-plan/data/training-plans.json"
};
```

## Publish key
`Publish Updates Live` uses your GitHub token (trainer device only). Do not share this page or key with students.

## Data file
Primary source of truth:
- `training-plan/data/training-plans.json`
