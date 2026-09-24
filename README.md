# DevHub — GitHub Developer & Repository Analytics

DevHub is a small full-stack app for exploring GitHub developers and repositories:
search users/repos, view developer profiles with stats (total stars/forks, top
languages, top repos), view repository analytics (language distribution,
contributors, weekly commit activity, open issues), save favorites behind auth,
and compare two repos or two developers side by side.

- **Backend:** Node.js + Express (CommonJS), SQLite via `node:sqlite`
  (`DatabaseSync`), JWT auth (`jsonwebtoken` + `bcryptjs`), server-side GitHub
  API proxy with 10-minute DB + in-memory cache and rate-limit tracking.
- **Frontend:** vanilla HTML/CSS/JS SPA (hash router, no build step, no CDN),
  served statically by the backend (same origin).

## Quickstart

Prerequisites: Node.js >= 22.

```bash
npm install
cp .env.example .env   # optional — or export the vars below
npm start              # serves API + frontend on http://localhost:3000
```

Open http://localhost:3000 in a browser. `npm run dev` restarts on file changes
(`node --watch`).

## Environment variables

| Variable       | Required | Default                  | Purpose                                        |
|----------------|----------|--------------------------|------------------------------------------------|
| `PORT`         | no       | `3000`                   | HTTP port the server listens on                |
| `GITHUB_TOKEN` | no       | (none)                   | GitHub personal access token; raises the GitHub API rate limit when set |
| `JWT_SECRET`   | no       | `devhub-secret-change-me`| Secret used to sign auth tokens (set in prod!) |
| `JWT_EXPIRES_IN` | no     | `7d`                     | Lifetime of issued JWTs                        |

The SQLite file `backend/devhub.db` is created automatically on first run.

## API

Auth: pass `Authorization: Bearer <token>` (from register/login) for
`🔒` endpoints. All responses are JSON.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | – | Liveness probe → `{ ok: true }` |
| POST | `/api/auth/register` | – | `{ username, email, password }` → `201 { token, user }`; `400` on bad input, `409` on duplicate |
| POST | `/api/auth/login` | – | `{ usernameOrEmail, password }` → `{ token, user }`; `401` on bad credentials |
| GET | `/api/auth/me` | 🔒 | Current user → `{ user }` |
| GET | `/api/search/users?q=&page=&per_page=` | – | GitHub user search → `{ items, total_count }`; `400` without `q` |
| GET | `/api/search/repos?q=&sort=&order=&page=&per_page=` | – | GitHub repo search → `{ items, total_count }`; `400` without `q` |
| GET | `/api/dev/:username` | – | `{ profile, repos, stats }` (`totalStars`, `totalForks`, `topLanguages`); `404` for unknown user |
| GET | `/api/repo/:owner/:name` | – | `{ repo, languages, languageDistribution, contributors, activity, openIssues }`; `404` for unknown repo |
| GET | `/api/ratelimit` | – | `{ github: { limit, remaining, reset }, cacheSize, tokenConfigured }` |
| GET | `/api/compare/repos?repoA=o/n&repoB=o/n` | – | `{ a, b, comparison[{ metric, a, b, winner }] }`; `400` on missing/bad params |
| GET | `/api/compare/devs?userA=&userB=` | – | Same shape for two users (followers, stars, forks, …) |
| GET | `/api/favorites` | 🔒 | List own favorites (empty array when none) |
| POST | `/api/favorites` | 🔒 | `{ kind: 'dev'‖'repo', ref, name?, … }` → `201`; `400` on bad `kind`/missing `ref`, `409` on duplicate |
| DELETE | `/api/favorites/:id` | 🔒 | `{ ok: true }`; `404` for foreign/missing id |
| * | `/api/*` (unknown) | – | `404 { error: 'Not found' }` |

GitHub upstream `403`/`429` responses are surfaced as `429` with a
`Retry-After` header; unreachable upstream surfaces as `502`.

## Project structure

```
DevHub/
├── backend/
│   ├── server.js          # express app: json, logging, static frontend, /api wiring, 404 + error middleware
│   ├── db.js              # node:sqlite store (users, favorites, cache) + cache helpers
│   ├── github.js          # GitHub fetch client: headers/token, 10-min cache, rate-limit capture
│   ├── auth.js            # bcrypt hashing, JWT sign/verify, requireAuth middleware
│   └── routes/
│       ├── auth.js        # register / login / me
│       ├── github.js      # search, dev profile, repo analytics, ratelimit
│       ├── favorites.js   # favorites CRUD (auth-gated)
│       └── compare.js     # repo-vs-repo and dev-vs-dev comparisons
├── frontend/
│   ├── index.html         # shell: navbar, auth modal, toasts, footer health dot
│   ├── styles.css         # dark theme, cards/tiles/bars/chart, responsive breakpoints
│   └── app.js             # hash-router SPA + API client (token in localStorage `devhub_token`)
├── package.json
└── README.md
```

Frontend routes: `#/` home (Users/Repos search tabs) · `#/dev/:username` ·
`#/repo/:owner/:name` · `#/dashboard` (auth-gated favorites) · `#/compare`.

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | `node backend/server.js` | Run the server |
| `npm run dev` | `node --watch backend/server.js` | Run with auto-reload |
