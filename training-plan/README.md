# HPE Training Studio

GitHub Pages, no build step. `trainer.html` and `index.html` load `studio.js`, `studio.css`, and `library.js`.

## Available now
- Direct template and client editing; stable client IDs; add weeks, sessions, and exercises.
- Eight original, concise movement guides with primary-source reference links; two teaching routines.
- Search and filter the library, add movements to sessions, or provide custom instructions.
- Device-local autosave and private backup/restore files.
- Mobile client session view, local completion tracking, and manually shared check-ins.
- Compressed plan snapshots in the URL fragment. Sharing requires a privacy acknowledgment. No keys or GitHub credentials in the active interface.

## Important boundaries
This is NOT an authenticated client-record system. GitHub Pages serves public static files. Local browser storage is not account-based or encrypted application storage. Anyone possessing a snapshot link can read its content. Links cannot be revoked, and old links do not update. Use initials and nonsensitive teaching examples only. Back up drafts before changing browsers or clearing storage.

The JSON data file contains legacy demonstration plans and remains public for existing sample links. The trainer workspace does not fetch or overwrite this roster. Legacy scripts/backend remain in source for migration reference, but are not loaded by the active pages. Coach-review now explains that its old key flow is retired.

The service worker retires only training-plan caches and does not cache new requests. Network access is required to load the app. It does not claim offline synchronization.

## Next phase: email sign-in links
User preference: email magic-link sign-in. Before enabling real clients, deploy an authentication/database service and configure email delivery plus production redirect URLs. Enforce trainer ownership, explicit client invitations, instructor roles, and row-level authorization on the server. Keep templates separate from assigned plans. Publish versioned plans atomically; clients see the latest authorized published revision. Store check-ins and replies privately, with timestamps, read state, revocation, conflict detection, and audit history. Verify cross-account access denial, email delivery, and cross-device persistence before labeling anything live or sent.

Do not recreate the old browser-token or shared coach-key design. Authentication cannot be implemented securely with a public configuration PIN.

## Local check
Run `python3 -m http.server 8765` from the repository root. Open `/training-plan/trainer.html`. Syntax checks: `node --check training-plan/studio.js` and `node --check training-plan/library.js`.
