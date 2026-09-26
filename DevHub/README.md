# DevHub

Repository: [varunsvn78-design/DevHub](https://github.com/varunsvn78-design/DevHub)

A full-stack workspace for discovering GitHub developers and repositories, understanding repository analytics, comparing projects and people, and keeping a personal collection.

The interface uses a charcoal, graphite, and off-white design with a responsive sidebar, accessible account dialogs, keyboard navigation, and reusable Tailwind components.

## Quick start

Use **Node.js 22.13 or newer** (Node 24 LTS recommended). SQLite is included in Node; no separate database service is required.

```bash
npm ci
cp .env.example .env
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000). Both the API and frontend are served by Express. The start/dev scripts load `.env` automatically. No GitHub token is required for public data, but unauthenticated GitHub quotas are limited.

For development, run these in separate terminals:

```bash
npm run dev
npm run dev:css
```

Tailwind CSS is compiled locally using the [Tailwind CLI](https://tailwindcss.com/docs/installation/tailwind-cli). Edit `frontend/input.css` or utility classes in the frontend modules, then rebuild. The generated `frontend/styles.css` is included so the interface can also run without a build tool at runtime.

## Feature checklist

| Requirement | Implementation |
| --- | --- |
| Registration and login | Bcrypt password hashing, JWT sessions, account validation, visible errors, sign out, expired-session recovery |
| Search GitHub users | Developer search, GitHub query qualifiers, result cards, pagination |
| Search GitHub repositories | Repository search, topic shortcuts, sorting, pagination, shareable search URLs |
| Developer profile | Bio, location, company, follower count, repository sample, language usage and star/fork aggregates |
| Repository details | Description, topics, license, repository link, stars, forks, open issues/PRs and watchers |
| Contributor information | Top ten contributors with contribution counts and links to profiles |
| Activity information | Weekly commit chart with an accessible text alternative, last push date, recent discussions |
| Language analytics | Distribution by source-code bytes and developer language usage by repository count |
| Favourite developers and repositories | Save controls, duplicate protection, per-account database persistence, removal |
| Dashboard | Collection totals, type filters, text filtering, empty and signed-out states |
| Backend REST API | Express routes, JSON validation and errors, authenticated collection endpoints |
| Database | SQLite users, favourites and cache; foreign-key enforcement and WAL mode |
| GitHub integration | Server-side requests; optional token stays on the server |
| Responsive frontend | Desktop sidebar and mobile navigation, flexible grids, overflow-safe comparison tables |
| Loading and errors | Skeletons, retry actions, no-results states, explicit unavailable/pending analytics |
| Repository comparison | Stars, forks, watchers, issues/PRs, size |
| Developer comparison | Profile metrics and clearly scoped repository aggregates |
| Caching and rate limits | Ten-minute memory + SQLite cache, upstream timeout, Retry-After handling and quota display |

### Analytics semantics

- GitHub's `open_issues_count` includes **open issues and pull requests**. DevHub labels this explicitly. The recent discussion list is a separate sample of up to five items; it is never used as the total.
- Watchers use GitHub's `subscribers_count`. GitHub's `watchers_count` is a legacy alias for stars and is not used for this metric.
- Developer repository analytics analyze **up to 100 most recently updated repositories**, including forks. The UI discloses the sample size; totals are not presented as exhaustive when more repositories exist. Failed aggregates are shown as unavailable rather than zero.
- Contributor information is a top-ten sample. Language distribution measures code bytes, not developer proficiency.
- GitHub may return `202` while generating activity statistics. Pending responses are not cached as complete results, and the UI offers refresh. Some repositories do not provide statistics.
- Search exposes at most GitHub's first 1,000 results. Change or narrow the query to explore a different result set.
- Favourite repository metadata and dashboard star totals are snapshots from when the item was saved; open its details to retrieve current analytics.
- Successful GitHub responses may be cached for approximately ten minutes. Quota display reflects the latest observed upstream response; GitHub applies different quotas to search and other resources.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port |
| `GITHUB_TOKEN` | None | Optional token for higher GitHub quotas |
| `JWT_SECRET` | Development-only fallback | Signing secret; production requires at least 32 characters |
| `JWT_EXPIRES_IN` | `7d` | Session lifetime |
| `DB_PATH` | `backend/devhub.db` | SQLite location; parent directory must exist |
| `NODE_ENV` | Unset | Set to `production` for deployment |

Generate a production secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Do not commit `.env`, database files, or tokens. The GitHub token is never sent to the browser. Run behind HTTPS in production. Browser authentication uses localStorage; signing out removes the local token. Production deployments should add infrastructure-level authentication throttling, backups, monitoring, and an appropriate reverse proxy.

## Commands and verification

| Command | Purpose |
| --- | --- |
| `npm start` | Serve app and REST API |
| `npm run dev` | Restart backend on source changes |
| `npm run build` | Compile and minify Tailwind styles |
| `npm run dev:css` | Watch frontend styles and templates |
| `npm test` | API/database and GitHub-client regression tests |
| `npm run test:e2e` | Desktop/mobile browser workflow tests |

API tests use a temporary SQLite database and a local HTTP server. External GitHub responses are stubbed for deterministic rate-limit, cache, and partial-failure tests. The suite covers search, pagination, account flows, saved collections, analytics, both comparisons, expired sessions, stale-request cancellation, mobile layout, and keyboard skip navigation. Browser tests use real local authentication and persistence, with intercepted GitHub responses so tests do not spend API quota. Browser tests use installed Google Chrome by default. To use Playwright Chromium instead, remove `channel: 'chrome'` from `playwright.config.js` and run `npx playwright install chromium`.

## Architecture

```text
frontend/
  index.html           Workspace shell and native account dialog
  input.css            Tailwind source and charcoal design system
  styles.css           Generated production stylesheet
  app.js               Routing, request cancellation, saved state, health
  lib/
    api.js             JSON client, session expiry, retry feedback
    auth.js            Authentication UI and account state
    ui.js              Escaping, safe URLs, icons, reusable components
  views/
    explore.js         Search, sorting, pagination, suggested queries
    details.js         Developer and repository analytics
    collection.js      Personal dashboard and collection management
    compare.js         Repository and developer comparisons
backend/
  server.js            Express application and middleware
  auth.js              Password hashing and JWT validation
  db.js                Schema, SQLite persistence, cache access
  github.js            GitHub client, caching, timeout and quota handling
  routes/              Auth, search/details, favourites, comparisons
tests/
  api.test.js          API and GitHub-client regression tests
  browser/             Playwright workflow tests
```

Rendering uses escaped text and validated external-link protocols. Route changes cancel obsolete requests so a slow response does not overwrite a newer page. SQLite statements are parameterized, and collection queries are scoped to the authenticated user.

## REST API

Authenticated endpoints require `Authorization: Bearer <token>` from registration or login. All endpoints return JSON.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Server health |
| POST | `/api/auth/register` | `{ username, email, password }` → token and user |
| POST | `/api/auth/login` | `{ usernameOrEmail, password }` → token and user |
| GET | `/api/auth/me` | Authenticated account |
| GET | `/api/search/users?q=&page=&per_page=` | Developer search |
| GET | `/api/search/repos?q=&sort=&order=&page=&per_page=` | Repository search |
| GET | `/api/dev/:username` | Profile, repositories, sampled analytics |
| GET | `/api/repo/:owner/:name` | Details, languages, contributors, activity, discussions, section status |
| GET | `/api/ratelimit` | Last observed quota and cache status |
| GET | `/api/compare/repos?repoA=owner/name&repoB=owner/name` | Repository comparison |
| GET | `/api/compare/devs?userA=login&userB=login` | Developer comparison and sample metadata |
| GET | `/api/favorites` | Authenticated user's collection |
| POST | `/api/favorites` | Save `{ kind: "dev" or "repo", ref, name?, avatar_url?, url?, stars?, description? }` |
| DELETE | `/api/favorites/:id` | Remove own saved item |

Validation errors return `400`, invalid authentication `401`, unavailable resources `404`, duplicate records `409`, and GitHub rate limits `429` with `Retry-After`. Upstream connection failures return `502`. Optional analytics failures are represented in `sectionStatus` without hiding the repository itself.

## Contributing

Report bugs and propose changes in [the DevHub repository](https://github.com/varunsvn78-design/DevHub). Keep commits focused, run the build and tests before submitting changes, and exclude local databases, secrets, dependencies, and test output from version control.
