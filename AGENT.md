# AGENT.md

Guidance for AI coding agents working on this repository.

## Project

AffiliateHub: an affiliate link tracking SaaS. Users create short tracking links, clicks are recorded, merchants report sales via a postback API, and a dashboard shows clicks, conversions, revenue and commission.

## Layout

```
server/            Express API (ESM, Node 22.13+)
  src/app.js       createApp(db, options): all routes, auth middleware
  src/db.js        createDb(path): SQLite schema via node:sqlite
  src/index.js     entry point, reads env vars
  test/            node:test integration tests (in-memory DB)
client/            React 18 + Vite
  src/api.js       fetch wrapper, token storage
  src/auth.jsx     AuthProvider / useAuth
  src/pages/       Dashboard, Links, Integration, AuthPage
  vite.config.js   proxies /api and /r to :4000
```

## Commands

```bash
npm run install:all   # install root, server and client deps
npm run dev           # API :4000 + web :5173
npm test              # server tests
npm run build         # production build of the client
```

Run `npm test` after any server change and `npm run build` after any client change.

## Conventions

- JavaScript only (ESM), 2-space indent, single quotes, semicolons.
- Server: keep routes in `app.js`; use prepared statements with `?` placeholders, never string-concatenate user input into SQL.
- API errors return `{ error: "message" }` with a proper status code; success payloads are JSON objects (`{ link }`, `{ links }`, ...).
- DB columns are `snake_case`; API responses are `camelCase` (map in DTO helpers like `linkDto`).
- Client: function components and hooks, plain CSS in `styles.css` using the CSS variables, no extra UI/chart libraries unless needed.
- Every new endpoint needs a test in `server/test/api.test.js` covering auth, validation and the happy path.

## Rules and gotchas

- Every query on user data must be scoped by `user_id` (directly or via a join on `links`). Never expose another user's data.
- Only `http:` and `https:` destination URLs are allowed for links.
- `/api/postback` authenticates with the `x-api-key` header, not JWT. One conversion per `click_id`.
- Store raw IPs nowhere; clicks keep only a truncated SHA-256 hash.
- Do not commit `.env`, `*.db` files or `node_modules`. Use `server/.env.example` for new config keys.
- `node:sqlite` is experimental; the warning is silenced via `--disable-warning=ExperimentalWarning` in the npm scripts. Keep that flag.
- Node 24 treats `node --test <dir>` as a module path, so the test script uses plain `node --test` (auto-discovery).
- Keep `README.md` in sync when adding features or endpoints.
