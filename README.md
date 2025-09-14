# Communities’ Choice Portal — GitHub Pages + Cloudflare Workers (No Firebase)
 
This keeps your existing UI exactly the same and adds a username + `password1` login that limits each member to their own Area plus Cross-Area. Admins see  everything.
 
## Files
- `public/index.html` — your HTML with a small auth include (injected at the end).
- `public/assets/auth.css` — login overlay styles.
- `public/assets/auth.js` — login + area filtering (non-invasive).
- `api/worker.js` — Worker endpoint for /api/login, /api/me, /api/logout.
- `api/users.json` — allowlist of users (generated from your spreadsheet).
- `tools/xlsx-to-users-json.mjs` — converts `data/Replit Users Committee Members.xlsx` → `api/users.json`.
- `wrangler.toml` — Worker config.
- `.github/workflows/deploy-worker.yml` — deploy Worker on push.
- `package.json` — local dev scripts.

## Setup

### A) Frontend (GitHub Pages)
1. Create a GitHub repo and add this whole folder structure.
2. Put your logo at `public/assets/Peoples Committee Portal logo v2.png`.
3. Enable GitHub Pages → Source: `main` / folder: `/public`.
4. In `public/assets/auth.js`, set `API_BASE` to your Worker URL, e.g.:
   ```js
   const API_BASE = "https://communities-choice-api.<subdomain>.workers.dev";
   ```

### B) Backend (Cloudflare Worker)
1. Create free Cloudflare account.
2. Get `CLOUDFLARE_ACCOUNT_ID` and an `CLOUDFLARE_API_TOKEN` with Workers permissions → save in GitHub Secrets.
3. Add a repo variable: `ALLOWED_ORIGIN` set to your GitHub Pages origin (e.g., `https://<user>.github.io` or full Pages URL).
4. Set `COOKIE_SECRET` via `wrangler secret put COOKIE_SECRET` (or dashboard).
5. Push to `main` → Action deploys Worker.

### C) Users from your spreadsheet
- Save your spreadsheet to `data/Replit Users Committee Members.xlsx`.
- On push, the Action generates `api/users.json`. Otherwise run locally:
  ```bash
  npm i
  npm run users:build
  git add api/users.json
  git commit -m "Update users"
  git push
  ```

### D) Behaviour
- On first load, UI is blurred and a login overlay appears.
- Members sign in with **username + password `password1`**.
- After login, only their Area + Cross-Area items are shown; all scoring matrix categories, applications viewer, and **existing PDF links** remain untouched.
- Admins (`dwatkins`, `tvaadmin`) see everything.
