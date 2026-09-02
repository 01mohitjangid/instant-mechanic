# Instant Mechanic — Live Operations Dashboard

A live operations dashboard for a vehicle service company. An operations team uses it to watch bookings, mechanics, customers and revenue as they change.

|                    |                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| **Live dashboard** | https://instant-mechanic-steel.vercel.app                                                        |
| **Live API**       | https://instant-mechanic-api-sazm.onrender.com                                                   |
| **API docs**       | [This README](#api) · live index at [`/api`](https://instant-mechanic-api-sazm.onrender.com/api) |

Built by **Mohit Jangid**.

---

## What it does

- **Overview** — 8 live figures: total, today's, completed, pending and cancelled bookings, revenue, active mechanics, new customers.
- **Analytics** — bookings over time, revenue over time, status split, revenue by service category.
- **Bookings** — a table of every job with search, filtering, sorting and pagination, plus a detail page with a full status timeline.
- **Mechanics** — who is available, who is on a job, how much each has completed and earned.
- **Customers** — booking history and lifetime value.
- **Live** — when a booking's status changes, every open dashboard updates itself. No refresh.

---

## Tech stack

| Layer      | Choice                           | Why                                                                                            |
| ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Frontend   | Next.js 16, React 19, TypeScript | Server Components render the data on the server, so the browser never downloads 1,000 bookings |
| Styling    | Tailwind CSS v4, shadcn/ui       | Semantic colour tokens, so dark mode is a token swap rather than a second stylesheet           |
| Charts     | Recharts                         |                                                                                                |
| Backend    | Node.js, Express 5, TypeScript   |                                                                                                |
| Real-time  | Socket.IO                        | Reconnects on its own and falls back to long-polling where WebSockets are blocked              |
| Database   | PostgreSQL (Neon)                | Relational data with real foreign keys and CHECK constraints                                   |
| Validation | Zod                              | Every query string is validated before it reaches SQL                                          |
| Hosting    | Vercel + Render                  |                                                                                                |

---

## Architecture

```
Browser (Next.js on Vercel)
   |
   |  HTTPS  ......  first render and every filter change
   |  WebSocket ...  status changes pushed the moment they happen
   v
Express API (Render)
   |
   |  parameterised SQL
   v
PostgreSQL (Neon)
```

## Project structure

```
instant-mechanic/
├── apps/
│   ├── api/                    Express API + WebSocket server
│   │   └── src/
│   │       ├── config/         environment variables, validated once at boot
│   │       ├── db/
│   │       │   ├── migrations/ the schema, as SQL
│   │       │   ├── queries/    all SQL lives here
│   │       │   └── seed/       650 realistic bookings
│   │       ├── middleware/     errors, request validation, logging
│   │       ├── realtime/       Socket.IO server
│   │       ├── routes/         12 GET endpoints + 1 PATCH
│   │       ├── services/       business logic
│   │       └── simulator/      moves bookings so the demo is alive
│   │
│   └── web/                    Next.js dashboard
│       └── src/
│           ├── app/            pages (App Router)
│           ├── components/     UI, charts, tables, filters
│           └── lib/            API client, formatting, URL filters
│
├── packages/
│   └── shared/                 types used by BOTH sides
│
├── render.yaml                 backend deployment config
└── vercel.json                 frontend deployment config
```

**One `node_modules` for the whole repo** (npm workspaces), and `packages/shared` holds the booking status types. Rename a status there and both the API and the dashboard fail to compile — they cannot drift apart.

---

## Database

Six tables: `services`, `customers`, `vehicles`, `mechanics`, `bookings`, `booking_status_history`.

Seeded with 650 bookings, 60 customers, 30 mechanics, 19 services across 8 categories, and about 2,900 status-history rows.

Three decisions worth pointing out:

1. **Money is `NUMERIC`, never a float.** A float loses paise. Amounts travel to the browser as strings and are only parsed for display.
2. **"Jobs completed" and mechanic ratings are not stored.** They are calculated from `bookings`, so there is one source of truth and the numbers cannot go stale.
3. **The database refuses impossible rows.** A completed booking must have a `completed_at`; a job that is under way cannot have one; anything past "pending" must have a mechanic.

`npm run db:verify` runs **16 integrity checks** against the live data — for example, that no mechanic is on two live jobs at once, and that every booking's last history row matches its current status.

---

## Local setup

```bash
git clone https://github.com/01mohitjangid/instant-mechanic.git
cd instant-mechanic
npm install                      # one install for the whole repo

cp apps/api/.env.example apps/api/.env
# put your PostgreSQL URL in DATABASE_URL

npm run db:reset                 # create the schema, seed it, verify it
npm run dev                      # API on :4000, dashboard on :3000
```

The dashboard needs no `.env` — it falls back to `http://localhost:4000`.

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Runs both apps                     |
| `npm run db:reset`  | Rebuilds and re-seeds the database |
| `npm run db:verify` | Runs the 16 integrity checks       |
| `npm run lint`      | Lints every workspace              |
| `npm run typecheck` | Typechecks every workspace         |

---

## Environment variables

**API** (`apps/api/.env`)

| Variable                | Default        | Notes                                                                                    |
| ----------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | —              | **Required.** PostgreSQL connection string                                               |
| `PORT`                  | `4000`         | Render sets this itself                                                                  |
| `NODE_ENV`              | `development`  |                                                                                          |
| `APP_TIMEZONE`          | `Asia/Kolkata` | "Today's bookings" is resolved in this zone, not the server's                            |
| `CORS_ORIGINS`          | `*`            | Comma-separated list of allowed origins                                                  |
| `TRUST_PROXY`           | `false`        | Set to `1` behind a proxy. Leaving it on without one lets anyone bypass the rate limiter |
| `RATE_LIMIT_MAX`        | `300`          | Requests per IP per window                                                               |
| `SIMULATOR_ENABLED`     | `true`         | Moves bookings along so the dashboard is alive                                           |
| `SIMULATOR_INTERVAL_MS` | `6000`         |                                                                                          |

**Dashboard** (`apps/web/.env`)

| Variable              | Default                 | Notes              |
| --------------------- | ----------------------- | ------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | The API's base URL |

Secrets are never committed. `render.yaml` marks `DATABASE_URL` as `sync: false`, so Render prompts for it once and it stays out of the repository.

---

**Booking lifecycle**

```
pending -> assigned -> on_the_way -> in_progress -> completed
                   \
                    -> cancelled  (from any unfinished state)
```

Only these moves are allowed. Anything else returns `409` with a message naming what _is_ allowed.

**Real-time**

Connect to the same origin with Socket.IO. Two events: `realtime:connected` on connect, and `booking:updated` whenever a booking moves.

---

## Deployment

```
GitHub  ->  Vercel   (dashboard)
        ->  Render   (API + WebSocket)
            Neon     (PostgreSQL)
```

Both platforms read their configuration from the repository — `vercel.json` and `render.yaml` — so the deployment is version controlled rather than clicked into a dashboard.

**A note on AWS.** The brief suggests AWS Free Tier. AWS requires a payment card to open an account, which I did not want to do for an assignment, so the API runs on Render's free tier instead. The application is containerised — `apps/api/Dockerfile` builds a 254 MB image that runs as a non-root user — so the same image runs on EC2 unchanged.

**Two problems worth recording**, because both cost a deploy:

1. `render.yaml` sets `NODE_ENV=production`, and npm reads that same variable during install and skips `devDependencies` — where TypeScript lives. The first build died on `tsc: command not found`. Fixed with `npm ci --include=dev`.
2. `docker run --env-file` passes the quotes in a `.env` file through literally, so `DATABASE_URL="postgres://…"` arrived with the quotes attached. The config now strips them.

Render's free tier sleeps after 15 minutes of inactivity, so the first request after a quiet period takes about 50 seconds.

---

## AI usage

**Tool:** codex, gemini and Claude opus (antigravity).

**Used for:** the initial implementation of the schema and seed script,  the Docker and deployment configuration and take help to debug some error.

- `Date.parse('2026-02-31')` succeeding — V8 rolls the impossible day over — so a nonsense date reached PostgreSQL and returned a 500 instead of a 422;
- a shutdown deadlock: Socket.IO shares the HTTP server, and `server.close()` waits forever on an upgraded WebSocket, so the pool was never drained;
- two transactions able to assign the same mechanic to two live jobs at once, fixed with `FOR UPDATE … SKIP LOCKED` and a check on the write path.


---

## What I am most proud of

**That the live data is provably correct, not just plausible.**

Anyone can seed a database with random rows. The harder thing is a dataset that stays honest while it is being mutated in real time. `npm run db:verify` runs 16 checks against the live database — no mechanic on two jobs at once, every booking's last history row matching its current status, no job completed before it started, no event dated in the future — and they all still pass while the simulator is actively writing.

One of those rules could not be expressed as a database constraint at all. "This mechanic is already on another job" is a fact about a _different_ row, and a `CHECK` constraint only sees one. So it is enforced on the write path behind a row lock, and every caller goes through that one path.

The runner-up is the real-time layer being genuinely real. The simulator does not emit fake events — it calls the same service the API route calls, so every change on screen is a real database write with a real audit row behind it.
