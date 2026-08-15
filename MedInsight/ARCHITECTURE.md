# Architecture Overview

## System Summary

MedInsight AI is a monorepo containing two applications:

- **`client/`** — A React single-page application (SPA) bootstrapped with Create React App.
- **`server/`** — A Node.js REST API built with Express.

In production, the Express server builds and serves the React frontend as static files, eliminating the need for a separate web server.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React SPA)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │  Login / │  │ Dashboard│  │  Reports │  │   AI Chat (Chatbot) │ │
│  │  Signup  │  │ (Main)   │  │  Pages   │  │                     │ │
│  └────┬─────┘  └─────┬────┘  └─────┬────┘  └──────────┬──────────┘ │
│       │              │             │                   │            │
│       └──────────────┼─────────────┼───────────────────┘            │
│                      │ Axios HTTP  │                                 │
└──────────────────────┼─────────────┼────────────────────────────────┘
                        │             │
         Authorization: Bearer <JWT>  │
                        ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS SERVER (Node.js)                        │
│                                                                     │
│   ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│   │ Middleware │  │    Routes    │  │        Services          │   │
│   │ - Helmet   │  │ /api/auth    │  │ - aiService.js           │   │
│   │ - CORS     │  │ /api/users   │  │ - biomarkerService.js    │   │
│   │ - compress │  │ /api/files   │  │ - cloudStorageService.js │   │
│   │ - rateLmt  │  │ /api/convers.│  │ - notificationService.js │   │
│   │ - sanitize │  │ /api/*report │  │ - activityService.js     │   │
│   │ - reqLogger│  │ /api/notif.  │  │ - embeddingService.js    │   │
│   │            │  │ /api/activit.│  │ - ragChunking.js         │   │
│   └────────────┘  │ /health      │  └──────────────────────────┘   │
│                   └──────────────┘                                  │
└──────────────┬────────────────────────────────┬────────────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────┐              ┌─────────────────────┐
│  MongoDB (Mongoose)  │              │  External Services  │
│  - users             │              │  - Cloudinary       │
│  - files             │              │    (file storage)   │
│  - bloodreports      │              │  - Google Gemini    │
│  - urinereports      │              │    (AI responses /  │
│  - stoolreports      │              │     embeddings)     │
│  - semenanalyses     │              └─────────────────────┘
│  - papsmears         │
│  - swabtests         │
│  - reportchunks      │
│  - conversations     │
│  - activities        │
│  - notifications     │
└──────────────────────┘
```

---

## Frontend Architecture

### Framework

React 18 with functional components and React Hooks. No class components. All routes are lazy-loaded using `React.lazy` + `Suspense` to reduce the initial bundle size.

### Routing

React Router DOM v6. Routes are defined in `App.js`. Authentication gating is implemented by conditionally rendering routes based on the presence of a JWT token in `localStorage`.

```
/               → Main dashboard (authenticated)
/chat           → AI chatbot interface (authenticated)
/reports        → Reports navigation hub (authenticated)
/reports/add    → PDF upload form + biomarker review (authenticated)
/reports/labreports → File list and history (authenticated)
/reports/results → Biomarker overview grid (authenticated)
/reports/biomarker/:name → Biomarker detail + history chart (authenticated)
/profile        → User profile editor (authenticated)
/activity       → Activity history log (authenticated)
/login          → Login page (public)
/signup         → Registration page (public)
```

### State Management

No external state management library (no Redux, no Zustand). Component-level state via `useState` and `useEffect` hooks. Global theme state is managed through a single React Context (`ThemeContext`).

### Styling

CSS Modules scoped per component (`.module.css`). Global styles and design tokens are defined in `index.css`. No CSS-in-JS library.

### HTTP Communication

All API calls are made with Axios. The JWT token is attached to every authenticated request as an `Authorization: Bearer <token>` header. Token is stored in `localStorage` after login.

---

## Backend Architecture

### Framework

Express 4 on Node.js. The entry point is `index.js`, which:

1. Validates required environment variables at startup.
2. Configures all middleware globally.
3. Registers all route handlers.
4. Starts the HTTP server.
5. Registers graceful shutdown handlers (`SIGINT`, `SIGTERM`).
6. Registers global uncaught exception and unhandled rejection handlers.

### Middleware Stack (applied in order)

| Middleware | Purpose |
|---|---|
| `compression` | Gzip/deflate all HTTP responses |
| `helmet` | Set secure HTTP response headers |
| `express.json()` | Parse JSON request bodies |
| `sanitizeMiddleware` | Strip HTML tags/script tags from all request inputs |
| `requestLogger` | Log every HTTP request/response with Winston |
| `globalLimiter` | 200 requests per 15 minutes per IP for all `/api/*` routes |
| `cors` | Allow only whitelisted origins; in development, also allow `localhost:3000` |

### Route Organization

Routes are mounted under `/api/*`. Each route file is self-contained and uses the `authMiddleware` JWT middleware on all protected endpoints.

The five non-blood report types (Urine, Stool, Semen Analysis, Pap Smear, Swab Test) share a **generic router factory** (`genericReportRouter.js`). The factory takes a Mongoose model and a report type name and produces a router with identical endpoint patterns for all report types.

### Services Layer

Business logic is separated into the `services/` directory:

- **`aiService.js`** — Manages the Gemini API client lifecycle (singleton) and generates chat responses using retrieved medical chunks as system context.
- **`biomarkerService.js`** — Evaluates biomarker status (Normal/High/Low) for both numeric and qualitative results. Contains the `REPORT_BIOMARKERS` mapping of expected biomarkers per report type.
- **`cloudStorageService.js`** — Handles file upload and deletion against Cloudinary. Falls back to local disk storage when Cloudinary is not configured.
- **`notificationService.js`** — Creates in-app notifications and triggers biomarker anomaly alerts after a report is saved.
- **`activityService.js`** — Persists activity log entries to MongoDB.
- **`embeddingService.js`** — Generates 768-dimension semantic vector embeddings using Google Gemini's `gemini-embedding-2` model with exponential backoff retry logic.
- **`ragChunking.js`** — Performs context-preserving, biomarker-based chunking of parsed PDF text, grouping related panels (e.g. CBC, Lipid) and doctor's notes.


---

## Database Design

MongoDB accessed via Mongoose. See [DATABASE.md](./DATABASE.md) for full schema details.

**Collections:**

| Collection | Purpose |
|---|---|
| `users` | User accounts and settings |
| `files` | Uploaded PDF file records |
| `bloodreports` | Blood test (CBC) biomarker data |
| `urinereports` | Urine analysis data |
| `stoolreports` | Stool test data |
| `semenanalyses` | Semen analysis data |
| `papsmears` | Pap smear data |
| `swabtests` | Swab test data |
| `reportchunks` | Parsed report text chunks and their 768-dimension vector embeddings |
| `conversations` | AI chat message history |
| `activities` | User activity log entries |
| `notifications` | In-app notification records |

---

## Security Architecture

- **Authentication:** Stateless JWT (HS256, 7-day expiry by default). Token is verified in `middleware/auth.js` on every protected route.
- **CORS:** Restricted to origins listed in `CLIENT_URL`. In development only, `localhost:3000` is additionally allowed.
- **Rate Limiting:** Custom in-memory IP-based limiter. Global: 200 req/15 min. Auth endpoint: 50 req/15 min. Registration: 20 req/15 min. Chat: 30 req/15 min. File upload: 15 req/15 min.
- **Input Sanitization:** `middleware/sanitize.js` strips all HTML script/tag content from `req.body`, `req.query`, and `req.params`.
- **Password Security:** bcrypt with salt factor 10 (configurable via `SALT` env var). Requires lowercase, uppercase, numeric, and symbol characters (min 8, max 128).
- **Timing Attack Prevention:** Login endpoint uses a dummy `bcrypt.compare` even when the user email is not found, preventing email enumeration via timing analysis.
- **Helmet:** Sets secure HTTP headers including Content-Security-Policy, X-Frame-Options, X-XSS-Protection, and others.
- **`x-powered-by` disabled:** Prevents Express version fingerprinting.
- **Error message sanitization:** 500-level errors return a generic message in production; internal error details are never leaked to clients.

---

## Logging Architecture

Winston is the logging backend. Logs are structured differently per environment:

- **Development:** Human-readable colorized output to console only.
- **Production:** JSON-structured output to console, `logs/error.log` (errors only, 5 MB max, 5 file rotation), and `logs/combined.log` (all levels, same rotation).

In production, the `overrideConsole()` function redirects all `console.log`, `console.warn`, `console.error`, etc. calls through the Winston logger for consistent structured output.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Generic report router factory | Avoids code duplication across 5 nearly-identical report types |
| In-memory rate limiter | Avoids adding a Redis dependency for a single-instance deployment |
| Cloudinary with local fallback | Supports development without cloud credentials; production uses Cloudinary |
| JWT stored in localStorage | Simplest approach for a SPA; appropriate for the current single-instance deployment model |
| pdf-parse with layout preservation | Custom `pagerender` function preserves horizontal tab spacing for accurate biomarker row extraction |
| Email alerts simulated to log files | Removes need for an SMTP provider dependency while preserving the alert logic |
| RAG with semantic retrieval & fallback | Uses Google Gemini's `gemini-embedding-2` for 768-dim embeddings queried via Atlas Vector Search, falling back to chronological lookup for local development |
| Panel-based RAG chunking | Grouping chunks by specific biomarker panel prevents misattribution of clinical values with similar names (e.g. pH in Urine vs Stool) |
| Multi-level isolated queries | Strict filtering by `userId` and `reportId` prevents cross-report data leakage and cross-user data leakage |
