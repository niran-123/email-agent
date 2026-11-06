# MailMind AI

> AI-powered email agent with Gmail integration, GPT-4 processing, and WhatsApp notifications.

## Stack

| Layer         | Technology                     |
| ------------- | ------------------------------ |
| Frontend      | React 18 + Vite + Tailwind CSS |
| Backend       | Node.js + Express (ES modules) |
| Database      | MongoDB Atlas (Mongoose)       |
| Cache / Queue | Redis 7 + BullMQ               |
| AI            | OpenAI GPT-4 (Phase 2+)        |
| Email         | Gmail API + Google Pub/Sub     |
| Notifications | WhatsApp Cloud API             |

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- Docker (for Redis)
- MongoDB Atlas account (free tier works)\*

### 1 — Start Redis

```bash
docker run -d --name mailmind-redis -p 6379:6379 redis:7
```

### 2 — Backend

```bash
cd backend
cp .env.example .env        # Fill in your values
npm install
npm run dev                 # Starts on http://localhost:5000
```

### 3 — Frontend

```bash
cd frontend
cp .env.example .env        # Adjust VITE_API_BASE_URL if needed
npm install
npm run dev                 # Starts on http://localhost:5173
```

---

## NPM Scripts

### Backend (`backend/`)

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Development server with hot-reload (nodemon) |
| `npm start`      | Production server                            |
| `npm run worker` | Start queue workers (Phase 2+)               |

### Frontend (`frontend/`)

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Vite dev server with HMR |
| `npm run build`   | Production build         |
| `npm run preview` | Preview production build |

---

## Project Structure

```
AI-AGENT-EMAIL/
├── backend/
│   ├── src/
│   │   ├── config/          # env, database, redis
│   │   ├── controllers/     # Route handlers
│   │   ├── middlewares/     # error, logger, rateLimiter
│   │   ├── models/          # Mongoose models (Phase 2+)
│   │   ├── routes/          # Express routers
│   │   ├── services/        # Business logic (Phase 2+)
│   │   ├── agents/          # AI agents (Phase 3+)
│   │   ├── queues/          # BullMQ queue definitions (Phase 2+)
│   │   ├── workers/         # BullMQ workers (Phase 2+)
│   │   ├── webhooks/        # Webhook handlers (Phase 3+)
│   │   └── utils/           # Shared utilities
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── layouts/         # Page layouts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # Axios API modules
│   │   ├── context/         # React context providers
│   │   └── utils/           # Formatting, clsx, etc.
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## API Endpoints

### System & Health

- `GET /api/health` — Returns status of application, MongoDB Atlas, and Redis.

### Authentication (`/api/auth`)

- `GET /api/auth/google` — Initiates Google OAuth2 consent flow (requests `gmail.readonly`).
- `GET /api/auth/google/callback` — Handles OAuth redirect, validates CSRF state, exchanges code for tokens, persists encrypted refresh token, and creates JWT session.
- `GET /api/auth/me` — Returns current authenticated user and connected accounts (`Bearer` token or cookie).
- `POST /api/auth/logout` — Terminates session and clears cookie.

### Gmail Integration (`/api/gmail`)

- `GET /api/gmail/status` — Returns connection status and count of synced emails in MongoDB.
- `GET /api/gmail/sync/status` — Detailed synchronization status, watch expiration, and processing queue counts.
- `GET /api/gmail/profile` — Retrieves live Gmail profile (messagesTotal, threadsTotal, historyId).
- `POST /api/gmail/sync` — Triggers manual sync of recent emails (configurable limit, default 20) with idempotent upsert and per-account locking.
- `POST /api/gmail/watch/start` — Registers Gmail mailbox watch with Google Cloud Pub/Sub.
- `POST /api/gmail/watch/renew` — Renews watch before 7-day expiration.
- `GET /api/gmail/emails` — Returns paginated synced emails stored in DB with optional search query (`?q=`).
- `DELETE /api/gmail/disconnect` — Stops active watch, disconnects account, and nullifies stored credentials.

### Webhooks (`/api/webhooks`)

- `POST /api/webhooks/gmail` — Google Cloud Pub/Sub push notification endpoint (OIDC token verified, deduplicated via Redis, enqueues to BullMQ, ACKs with 200).

---

## Phase Roadmap

- [x] **Phase 1** — Foundation (Express, React, Vite, MongoDB, Redis, Health check)
- [x] **Phase 2** — Google OAuth2, Gmail API integration, AES-256-GCM token encryption, MIME parsing, and manual sync
- [x] **Phase 3** — Email ingestion, automatic Gmail sync (users.watch, Pub/Sub webhook, History API change detection, BullMQ queues, reconciliation scheduler)
- [ ] **Phase 4** — WhatsApp Cloud API integration & AI Agent email triage / reply generation (GPT-4)

---

## Phase 1 Testing Checklist

- [ ] `npm run dev` starts backend without errors on port 5000
- [ ] `npm run dev` starts frontend without errors on port 5173
- [ ] `GET http://localhost:5000/api/health` returns 200 with service statuses
- [ ] Health page at `http://localhost:5173/health` displays live status
- [ ] MongoDB shows "connected" in health response
- [ ] Redis shows "connected" in health response
- [ ] CORS allows requests from `http://localhost:5173`
- [ ] Unknown routes return 404 JSON (not HTML)
- [ ] Rate limiter returns 429 after 100 req/min
- [ ] Graceful shutdown on `Ctrl+C` logs disconnect messages
