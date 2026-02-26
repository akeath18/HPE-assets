# Training Plan Web App

Mobile-first training plan portal for clients and students.

## What this app does
- Shows one training plan per link using `?client=<client-id>`.
- Mirrors your template sections: profile, goals, weekly sessions, check-ins, and final assessment.
- Works on phones and can be installed to the home screen (PWA support).

## Local preview
From this folder, run a simple static server:

```bash
cd training-plan-webapp
python3 -m http.server 8080
```

Then open:
- `http://localhost:8080/` for the client directory page
- `http://localhost:8080/?client=maria-thompson` for a direct client plan

## Update plans
1. Edit `data/training-plans.json`.
2. Update `lastUpdated` in the same file.
3. Republish the `training-plan-webapp` folder.

## Add a new client
1. Duplicate one client object in `data/training-plans.json`.
2. Set a unique `id` (for example `john-smith`).
3. Update profile, weekly sessions, and final assessment fields.
4. Share this direct link format:
   - `https://your-domain.com/?client=john-smith`

## Deployment options
- GitHub Pages (recommended for simple static hosting)
- Netlify drag-and-drop deployment
- Vercel static deployment

Publish the contents of this folder as the site root.
