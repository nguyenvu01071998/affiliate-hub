# AffiliateHub

A full-stack **affiliate link tracking SaaS**. Affiliates create short tracking links, the platform records every click, merchants report sales through a postback API, and a dashboard shows clicks, conversion rate, revenue and commission earned.

**Stack:** React 18 + Vite + React Router · Node.js + Express · SQLite (`node:sqlite`) · JWT auth · Node test runner

## Features

- Email/password sign-up and login (bcrypt-hashed passwords, JWT sessions)
- Create tracking links with a custom commission rate; copy the short URL in one click
- `GET /r/:slug` records the click (hashed IP, user agent, referrer) and redirects with a unique `click_id`
- Server-to-server **postback API** (`x-api-key`) turns a click into a conversion and computes commission; duplicate conversions are rejected
- Dashboard: totals, conversion rate, 14-day clicks vs. conversions chart, top links
- Per-user data isolation, input validation, only `http(s)` destinations allowed
- API integration tests

## Architecture

```
client/ (React)  --/api, /r-->  server/ (Express)  -->  SQLite
                                  ├─ auth (JWT)
                                  ├─ links CRUD
                                  ├─ /r/:slug  click tracking + redirect
                                  ├─ /api/postback  conversions + commission
                                  └─ /api/stats  aggregated analytics
```

Tables: `users`, `links`, `clicks`, `conversions` (see [server/src/db.js](server/src/db.js)).

## Getting started

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`, no native dependencies).

```bash
npm run install:all
cp server/.env.example server/.env   # optional, defaults work for local dev
npm run dev                          # API on :4000, web on :5173
npm test                             # backend integration tests
```

Open http://localhost:5173, sign up, create a link, and open its short URL.

## Try the conversion flow

```bash
# 1. Visit the short link (copy it from the Links page) and note the click_id in the redirect URL
curl -i http://localhost:4000/r/<slug>

# 2. Report a sale (API key is on the Integration page)
curl -X POST http://localhost:4000/api/postback \
  -H "Content-Type: application/json" -H "x-api-key: <your key>" \
  -d '{"click_id":"<click_id>","amount":49.99}'
```

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | – | Create account |
| POST | `/api/auth/login` | – | Get JWT |
| GET | `/api/me` | JWT | Current user + API key |
| GET/POST | `/api/links` | JWT | List / create links |
| DELETE | `/api/links/:id` | JWT | Delete a link |
| GET | `/api/stats` | JWT | Totals, daily series, top links |
| GET | `/r/:slug` | – | Track click and redirect |
| POST | `/api/postback` | API key | Record a conversion |

## Possible next steps

- Payout requests and an admin view for merchants
- Rate limiting and bot filtering on `/r/:slug`
- Postgres + migrations, Docker Compose, CI workflow
