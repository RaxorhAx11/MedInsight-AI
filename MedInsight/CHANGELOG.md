# Changelog

All notable changes to MedInsight AI are documented in this file.

---

## [1.0.0] — 2026-08-02

### Initial Release

MedInsight AI v1.0.0 is the first complete production-ready release of the application.

---

### Core Features

**PDF Report Upload and Biomarker Extraction**
- Upload machine-readable PDF lab reports (max 15 MB)
- Custom PDF text extraction with layout-aware parsing using `pdf-parse`
- Automatic biomarker extraction via regex matching against a comprehensive `biomarkers.json` reference database
- Support for both numeric and qualitative (text) biomarker result types
- Automatic biomarker status classification: Normal, High, Low, Not Mentioned
- Dynamic value scaling for unit mismatches between PDF and reference data

**Multi-Report Type Support**
- Blood Test (CBC)
- Urine Analysis
- Stool Test
- Semen Analysis
- Pap Smear
- Swab Test
- All non-blood report types powered by a shared generic router factory

**AI Chat Assistant**
- Powered by Google Gemini (`gemini-3.6-flash`)
- Per-report isolated context: AI responses are strictly grounded to the selected report
- Persistent conversation history stored in MongoDB per user
- Automatic CBC detection within Blood Test reports
- Animated bot response display on frontend

**Biomarker Visualization**
- Biomarker overview grid with color-coded status cards
- Individual biomarker historical trend charts (Recharts line charts)
- Reference range annotation on history charts
- Expected biomarker scaffolding: missing biomarkers shown as "Not Mentioned"

**User Management**
- User registration with strong password policy enforcement
- JWT-based stateless authentication (HS256, 7-day default expiry)
- User profile management: name, age, height, weight, sex
- Profile avatar upload (Cloudinary or local fallback)
- Application settings: theme, email alerts, AI insights, auto anomaly detection

**Notifications System**
- Automatic notifications for: report upload, AI analysis completion, abnormal biomarker detection, profile updates, settings changes
- In-app notification center: read, mark all as read, dismiss, clear all
- Email alert simulation (log file output when email alerts are enabled)

**Activity Log**
- Automatic activity tracking for: uploads, AI analyses, health alerts, deletions, profile and settings changes
- Retroactive activity seeding for users with existing reports
- Filterable by activity type

**File Management**
- List uploaded PDF files with Cloudinary or local file URL resolution
- Delete report with cascading removal of associated biomarker data across all collections
- Orphan file cleanup on upload/delete failures

---

### Infrastructure and Operations

**Security**
- Helmet security headers
- CORS restricted to explicit origins (`CLIENT_URL`)
- Custom in-memory rate limiting per IP (global + per-endpoint limits)
- HTML/script tag input sanitizer on all request inputs
- Timing-attack-resistant login flow
- JWT algorithm pinning (HS256 only)
- Error message sanitization in production (no stack trace leakage)

**Performance**
- HTTP response compression (gzip)
- Lazy-loaded React components for reduced initial bundle size
- React `Suspense` fallback with loading spinner
- MongoDB compound indexes on all frequently-queried fields
- Connection pooling with configurable pool size

**Observability**
- Winston structured logging (JSON in production, colorized dev format in development)
- HTTP request/response logging with method, URL, status, duration, IP, and user agent
- File-based persistent error and combined logs in production (5 MB rotating, 5 files)
- `console.*` override in production for consistent structured output
- Health check endpoint (`GET /health`, `GET /api/health`) with DB status and system metrics
- Graceful shutdown on `SIGINT`/`SIGTERM` with 10-second force-exit timeout
- Global uncaught exception and unhandled rejection handlers

**Database**
- MongoDB Atlas-ready connection with retry logic (configurable attempts and delay)
- Connection event monitoring (connected, disconnected, error, reconnected)
- Configurable connection pool, timeout, and index settings

**Storage**
- Cloudinary integration for PDF reports and avatars (raw resource type for PDFs)
- Local filesystem fallback when Cloudinary is not configured
- Automatic old avatar cleanup on profile photo update

**Frontend**
- React 18 SPA with React Router DOM v6
- Dark/light mode via React Context (`ThemeContext`)
- CSS Modules for scoped component styling
- Animated splash screen on first visit
- Scroll-reveal animation wrapper (`ScrollReveal.jsx`)
- `marked` library for rendering AI response markdown

---

### Known Limitations in v1.0.0

- Scanned (image-based) PDFs are not supported — OCR is not implemented
- Email alerts are simulated to log files — no actual email delivery
- Rate limiting is in-memory only — not suitable for multi-instance deployments
- No password reset flow
- No account deletion endpoint
- No JWT refresh token mechanism
