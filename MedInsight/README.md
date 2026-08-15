# MedInsight AI — Intelligent Biomarker-Based Medical Report Analyzer

MedInsight AI is a full-stack web application that allows users to upload PDF medical lab reports, automatically extract and classify biomarker values, visualize health trends over time, and interact with an AI-powered chat assistant for report-specific insights.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [RAG Pipeline Architecture](#rag-pipeline-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Running Locally](#running-locally)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Contributing](#contributing)

---

## Features

- **PDF Report Upload** — Upload medical lab reports (PDF, max 15 MB) and automatically extract biomarker values.
- **Biomarker Classification** — Each extracted biomarker is compared against a reference range database and classified as Normal, High, Low, or Not Mentioned.
- **Multi-Report Type Support** — Blood Tests (CBC), Urine Analysis, Stool Tests, Semen Analysis, Pap Smear, and Swab Tests.
- **Biomarker History Charts** — Visualize the historical trend of any individual biomarker across multiple reports using interactive Recharts line graphs.
- **AI Chat Assistant** — Ask natural-language questions about a selected report. Powered by Google Gemini. Responses are strictly grounded to the selected report.
- **Persistent Chat Conversations** — Conversation history is stored per user and linked by a unique conversation ID.
- **Notifications** — Automated in-app alerts for report uploads, AI analysis completion, and abnormal biomarker detections.
- **Activity Log** — Chronological log of all user actions: uploads, analyses, health alerts, profile and settings updates.
- **User Profile** — Manage personal health data (age, height, weight, sex) and upload a profile avatar.
- **User Settings** — Toggle dark/light theme, enable/disable email alerts, AI insights, and auto anomaly detection preferences.
- **Cloud File Storage** — PDFs and avatars are stored on Cloudinary when configured; falls back to local `uploads/` directory otherwise.
- **Dark Mode** — Full application-wide dark/light theme controlled via React context.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 | SPA framework |
| Frontend Routing | React Router DOM v6 | Client-side routing |
| Frontend HTTP | Axios | API calls |
| Frontend Charts | Recharts | Biomarker history visualization |
| Frontend Markdown | marked | Rendering AI response markdown |
| Frontend Icons | react-icons | UI icon library |
| Backend | Node.js + Express 4 | REST API server |
| Database | MongoDB (Mongoose 6) | Data persistence |
| AI | Google Gemini API (`@google/genai`) | Conversational AI responses |
| PDF Parsing | pdf-parse | Text extraction from uploaded PDFs |
| File Storage | Cloudinary (local fallback) | PDF and avatar storage |
| Authentication | JSON Web Token (jsonwebtoken) | Stateless auth tokens |
| Password Hashing | bcrypt | Secure password storage |
| Validation | Joi + joi-password-complexity | Request body validation |
| Logging | Winston | Structured production logging |
| Security | Helmet, CORS, custom rate limiter, sanitizer | Security headers, CORS, rate limiting, XSS sanitization |
| Compression | compression | HTTP response compression |

---

## RAG Pipeline Architecture

### Overview
MedInsight AI uses a Retrieval-Augmented Generation (RAG) pipeline to ground AI chat answers in the user's actual report data. This avoids stuffing the entire report text into every prompt—saving API tokens and reducing latency—while supporting queries across the user's full report history.

### Pipeline Stages
1. **Report Upload:** The user uploads a machine-readable PDF medical report.
2. **Biomarker Extraction & Panel Classification:** Biomarkers are extracted and classified into panels (e.g., CBC, Urinalysis, Stool Analysis).
3. **Biomarker-Based Chunking:** Extracted data is chunked and grouped by biomarker panel to preserve clinical context.
4. **Embedding Generation:** Chunks are converted into 768-dimension vector embeddings using the `text-embedding-004` model from Gemini.
5. **MongoDB Storage:** Embeddings and metadata are saved in the `ReportChunk` collection.
6. **Vector Indexing:** Chunks are indexed via MongoDB Atlas Vector Search.
7. **Semantic Retrieval:** User queries are embedded and retrieved using `$vectorSearch`, filtered by both `userId` and the active `reportId`.
8. **Answer Generation:** Retrieved chunks are used as context to ground the Gemini model's final response.

### Data Isolation
To ensure strict security and prevent unauthorized access, all retrieval queries filter by both `userId` and the active `reportId`. This double-filtering guarantees that users only see their own data, strictly scoped to the currently selected medical report.

### Testing
A regression test suite ([testRag.js](file:///d:/MedInsight%20AI%20-%20Intelligent%20Biomarker-Based%20Medical%20Report%20Analyzer/MedInsight/server/scripts/testRag.js)) automatically verifies the correctness of the RAG system. It tests chunking logic, report isolation, user isolation, value accuracy, handling of missing data, general-knowledge fallback, and native vector search queries, generating a structured summary table of results.

### Known Engineering Challenges Solved
- **Cross-Report Data Leakage:** Solved an issue where the retrieval step omitted the `reportId` filter, causing search queries to leak context from historical reports into the current active chat.
- **Biomarker Value Misattribution:** Fixed a bug where values with similar names (e.g., pH in Urinalysis vs. pH in Stool Analysis) were cross-contaminated by grouping chunks strictly by their biomarker panel.

---

## Prerequisites

- **Node.js** v16 or later
- **npm** v8 or later
- **MongoDB** — A local MongoDB instance or a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI
- **Google Gemini API Key** — Obtain from [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Cloudinary Account** *(optional)* — Required for cloud-based file storage; falls back to local disk if not configured

---

## Installation

```bash
# Install server dependencies
cd MedInsight/server
npm install

# Install client dependencies
cd ../client
npm install
```

---

## Environment Setup

Copy `.env.example` to `server/.env` and fill in the required values:

```bash
cp .env.example server/.env
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | Full MongoDB connection string |
| `JWTPRIVATEKEY` | Yes | Secret key for JWT signing |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `CLIENT_URL` | Yes (production) | Comma-separated allowed CORS origins |
| `PORT` | No | Server port (default: `8080`) |
| `NODE_ENV` | No | `development` or `production` |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret |

See [`.env.example`](./.env.example) for the full list with descriptions.

---

## Running Locally

```bash
# Terminal 1 — Backend (with nodemon auto-reload)
cd MedInsight/server
npm start

# Terminal 2 — Frontend React dev server
cd MedInsight/client
npm start
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080
- **Health Check:** http://localhost:8080/health

---

## Building for Production

```bash
# 1. Build the React frontend
cd MedInsight/client
npm run build

# 2. Start the server — it serves the build in production mode
cd ../server
NODE_ENV=production npm start
```

In production, Express serves the React build from `client/build` and handles SPA routing via a catch-all route.

---

## Project Structure

```
MedInsight/
├── client/                     # React frontend
│   ├── public/                 # Static public assets
│   └── src/
│       ├── App.js              # Root component with all routes
│       ├── index.js            # React entry point
│       ├── index.css           # Global CSS styles and design tokens
│       ├── context/
│       │   └── ThemeContext.jsx # Dark/light mode global context
│       └── components/
│           ├── SplashScreen/   # Animated splash screen (first visit)
│           ├── Login/          # Login page
│           ├── Signup/         # Registration page
│           ├── Navbar/         # Navigation bar
│           ├── LoadingSpinner/ # Loading fallback component
│           ├── ScrollReveal.jsx # Scroll-triggered animation wrapper
│           ├── Charts/         # Recharts chart wrappers
│           ├── Main/           # Dashboard, chat, profile, activity pages
│           └── Reports/        # Report management pages
│
└── server/                     # Node.js / Express backend
    ├── index.js                # App entry point, middleware, route registration
    ├── db.js                   # MongoDB connection with retry logic
    ├── controllers/            # Route business-logic helpers
    ├── middleware/             # auth, rate limiter, request logger, sanitizer
    ├── models/                 # Mongoose schemas (User, File, Reports, etc.)
    ├── routes/                 # Express route handlers
    ├── services/               # AI, biomarker, cloud storage, notifications, activities
    ├── utils/                  # Winston logger
    └── data/
        └── biomarkers.json     # Reference database of all supported biomarkers
```

---

## Troubleshooting

**Server fails with `FATAL CONFIGURATION ERROR`**
Ensure `MONGODB_URI`, `JWTPRIVATEKEY`, and `GEMINI_API_KEY` are set in `server/.env`.

**`Port 8080 is already in use`**
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

**PDF upload fails with "Error processing PDF data"**
The PDF is likely image-based (scanned). MedInsight AI requires machine-readable text-layer PDFs.

**AI Chat returns an error**
Verify `GEMINI_API_KEY` is a valid key. Check server logs for the specific Gemini API error message.

**Files stored locally instead of Cloudinary**
Expected when Cloudinary credentials are missing or contain placeholder values. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

---

## FAQ

**Which report types are supported?**
Blood Test (CBC), Urine Analysis, Stool Test, Semen Analysis, Pap Smear, and Swab Test.

**Are scanned/image-based PDFs supported?**
No. Only machine-readable (text-layer) PDFs are supported.

**Where are uploaded files stored?**
In Cloudinary if configured, otherwise in `server/uploads/` on the local filesystem.

**Is the AI chat connected to all my reports?**
No. The assistant answers questions exclusively about the single report selected in the chat interface.

**How long are JWT tokens valid?**
7 days by default. Controlled by the `JWT_EXPIRATION` environment variable.

**How does email alerting work?**
Email alerts are simulated: a `.log` file with the email content is written to `server/uploads/email_logs/`. No actual emails are sent.

---

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.
