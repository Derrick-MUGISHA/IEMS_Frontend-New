# IEMS — Igire Rwanda Event Management System

Event registration, ticketing, and QR check-in platform for Igire Rwanda Organization, built with Next.js 16 (App Router, React 19), MongoDB/Mongoose, Nodemailer (Gmail), and Cloudinary.

## How it works

- **Participants** are pre-registered (name, email, phone, stack/cohort). They enter their email at `/verify`, receive a magic link (30-min, single-use), verify, add a photo, and get a QR-code ticket by email and on their `/dashboard`. Sessions use a short-lived access token plus a rotating httpOnly refresh cookie.
- **Plus-ones** — each participant may bring exactly one. The participant either fills the plus-one's details on the dashboard, or shares an invite link (`/plus-one/<token>`, 72h) for the guest to complete themselves. The plus-one gets their own pass after verifying and adding a photo.
- **Guests** are added directly by an admin (VIP, speaker, sponsor, media, partner, general) and get a ticket immediately.
- **Admins** sign in with email + password at `/admin`. There is a single admin role (`ADMIN`). Admins manage events, attendees, guests, tickets, scanner accounts, and view the live dashboard and notifications.
- **Gate scanners** are dedicated accounts that sign in with email + password and check tickets in at `/scan`. Every ticket admits once; the check-in is an atomic claim and every scan is logged. Admins can also scan.

## Roles at a glance

| Role | Auth | Where | Token |
| --- | --- | --- | --- |
| Participant / plus-one | Passwordless magic link | `/verify` → `/dashboard` | 15-min access token in memory + rotating refresh cookie |
| Admin | Email + password | `/admin` | JWT (bearer) in localStorage |
| Scanner | Email + password | `/scan` | JWT (bearer) in localStorage |

## Setup

1. Copy `.env.example` to `.env.local` and fill in **every** required value (the seed refuses to run with unset or `change-me` secrets):
   - `MONGODB_URI` — e.g. `mongodb://localhost:27017/iems`
   - `JWT_SECRET` — `openssl rand -hex 32` (≥32 chars, required)
   - `GMAIL_USER` / `GMAIL_APP_PASSWORD` — a Gmail address and [app password](https://myaccount.google.com/apppasswords)
   - `MAIL_FROM_ADDRESS` — the no-reply sender mailbox or authorised Gmail sender alias. Defaults to `no-reply@igirerwanda.org`, matching IgireNodeMailerV2; Gmail must allow the selected sender address.
   - `MAIL_REPLY_TO` — optional reply address, defaults to the sender mailbox.
   - `CLOUDINARY_*` — from your Cloudinary dashboard
   - `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` — admin bootstrap credentials (≥8 chars)
   - `SCANNER_EMAIL` / `SCANNER_PASSWORD` — gate account (≥8 chars; **must differ** from the admin password)
2. Start MongoDB, e.g. `podman run -d --name iems-mongo -p 27017:27017 docker.io/library/mongo:7`
3. Install and seed:

```bash
pnpm install
pnpm seed     # super admin, gate scanner, the seeded event, and pre-registered participants
pnpm dev
```

Scripts: `pnpm dev` · `pnpm build` · `pnpm start` · `pnpm lint` · `pnpm test` · `pnpm seed` · `pnpm health`.

## Start with a public ngrok URL

Install Docker and the [ngrok CLI](https://ngrok.com/docs/gateway/endpoints/agent-cli-quickstart), then configure your ngrok account once with `ngrok config add-authtoken YOUR_TOKEN`. Keep the token out of the repository.

```bash
pnpm dev     # Docker development + ngrok, with hot reload
pnpm start   # Docker production build + ngrok
```

Both commands print the public HTTPS URL, admin URL and scanner URL after the app is ready. They set the public app URL for invitation and ticket links automatically. An existing IEMS tunnel is reused; switching between development and production moves that same public URL to the selected container. Only one of these environments is exposed at a time. Other applications' ngrok endpoints are left alone.

Keep the ngrok terminal open. If this command started ngrok, Ctrl+C closes its tunnel; Docker keeps running. If an ngrok agent was already running, it is reused and stays running. Set `IEMS_NGROK_URL=https://your-reserved-domain.ngrok.app` before startup if your account has a particular domain to use when creating a tunnel. The default ngrok agent API must be available on `127.0.0.1:4040`.

Use `pnpm dev:local` or `pnpm start:local` for the original Next.js commands without Docker or ngrok. The Docker-only commands below also remain available.

## Docker

Production and development both run the complete Next.js app, including the user pages, admin panel and API. Docker must be running. Fill in `.env` first; secrets are passed at runtime and excluded from the image.

```bash
# Production: http://localhost:3002
docker compose up --build -d
docker compose ps
docker compose logs -f app

# Development with hot reload: http://localhost:3003
docker compose -f compose.dev.yaml up --build --renew-anon-volumes -d

# Stop either environment
docker compose down
docker compose -f compose.dev.yaml down
```

Override `IEMS_PORT` (production) or `IEMS_DEV_PORT` (development) to change the host port. Set `IEMS_ENV_FILE=.env.local` to use another runtime environment file. Both environments use your configured MongoDB; if it runs on the host, replace `localhost` in `MONGODB_URI` with `host.docker.internal`. No database is seeded automatically.

Set `NEXT_PUBLIC_APP_URL` to the browser-facing application URL before building; Next.js embeds this public value in the production build, including invitation and ticket links. For local production testing, use `NEXT_PUBLIC_APP_URL=http://localhost:3002 docker compose up --build -d`. Rebuild production after source changes. Development mounts the source and keeps its dependencies and build cache in separate Docker volumes. After dependency changes, rerun the development command above; `--renew-anon-volumes` loads dependencies from the rebuilt image.

The production image uses Next.js standalone output, includes ticket fonts and public assets, runs as a non-root user, and checks `/api/health` for HTTP liveness. This endpoint does not check MongoDB or email delivery. Only run one production replica; see the deployment note below.

## Deployment note (important)

IEMS is currently a **single-instance** application. The live scan feed, admin notifications, the auth rate limiter, and the public-events cache all live in-process (`globalThis`). Running more than one instance behind a load balancer will drop live updates and weaken rate limiting. See `docs/` for the path to horizontal scale (Redis-backed pub/sub + shared cache/limiter).

## Key paths

| Path | Purpose |
| --- | --- |
| `src/models/` | Mongoose schemas: `Admin`, `Event`, `Participant`, `Guest`, `Ticket`, `Scanner`, `ScanLog`, `Notification`, `VerificationToken`, `RefreshToken`, `Counter`, `HealthSample` |
| `src/app/api/` | Route handlers (`auth`, `me`, `plus-one`, `scan`, `scanner`, `tickets`, `events`, `admin/*`) |
| `src/lib/` | db connection, JWT auth, session/refresh tokens, mailer, Cloudinary, QR, ticket issuance, SSE bus |
| `src/proxy.ts` | Edge rate limiter for auth/login endpoints |
| `scripts/seed.ts` | Idempotent seed (participants parsed from cohort CSVs) |
| `/verify`, `/dashboard`, `/ticket/[code]` | Participant flow |
| `/admin`, `/admin/*` | Admin panel |
| `/scan` | Gate check-in |

## Review & release docs

A full production-readiness assessment lives in [`docs/`](docs/README.md): system assessment, security, performance, UI/UX, technical debt, the release-readiness checklist, the changelog, and the post-v1 roadmap.
