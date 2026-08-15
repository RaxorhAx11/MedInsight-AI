# Contributing Guide

Thank you for your interest in contributing to MedInsight AI. Please read this guide before opening a pull request.

---

## Project Structure

Review [ARCHITECTURE.md](./ARCHITECTURE.md) and [README.md](./README.md) to understand the codebase structure before making changes.

---

## Development Setup

1. Follow the setup instructions in [README.md](./README.md).
2. Ensure both `npm start` commands (client and server) run without errors.
3. Verify the health endpoint responds: `curl http://localhost:8080/health`

---

## Coding Standards

### General

- Write clear, self-documenting code. Add comments only where logic is non-obvious.
- Do not leave `console.log` debug statements in committed code (use `logger.info/debug` on the server, remove on the client).
- Remove all unused imports and variables before committing.
- Keep functions focused and small.

### JavaScript / Node.js (Server)

- Use `const` for all declarations; use `let` only when the variable must be reassigned.
- Use `async/await` — do not use raw Promises with `.then()/.catch()` chains in new code.
- Always `try/catch` async operations in route handlers and services.
- Validate all external input with Joi before accessing `req.body` or `req.params`.
- Enforce user ownership on all database queries (`{ userId: req.user._id }` — never trust client-supplied userId).
- New API endpoints must be protected with `authMiddleware` unless explicitly public.

### React / Frontend

- Use functional components with hooks. No class components.
- Use CSS Modules for component styles. Do not write inline `style={{}}` props for layout or visual styles.
- Do not hardcode API base URLs. Use environment variables or relative paths.
- Clean up side effects in `useEffect` return functions where appropriate.
- Lazy-load new page-level components using `React.lazy()`.

### File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase | `BiomarkerCard.jsx` |
| CSS Modules | camelCase `.module.css` | `biomarkerCard.module.css` |
| Server routes/services | camelCase | `biomarkerService.js` |
| Server models | camelCase | `bloodReport.js` |

---

## Development Workflow

### Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable production-ready code |
| `develop` | Active integration branch |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation changes only |
| `refactor/<name>` | Refactoring with no functional changes |

**Always branch from `develop`, not `main`.**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

---

## Commit Message Conventions

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code change with no functional change |
| `style` | Formatting, whitespace, CSS tweaks |
| `test` | Adding or updating tests |
| `chore` | Build scripts, dependency updates |

**Examples:**

```
feat(reports): add semen analysis biomarker history chart
fix(auth): handle expired token error message correctly
docs(api): add conversation endpoints to API_DOCUMENTATION.md
refactor(server): extract biomarker status logic into service
```

---

## Pull Request Guidelines

1. Create a PR against the `develop` branch.
2. Title your PR using the same Conventional Commits format as your commits.
3. In the PR description, explain:
   - What the change does
   - Why it is needed
   - How to test it
4. Keep PRs focused. One concern per PR.
5. Do not include unrelated formatting changes in feature PRs.

---

## Adding a New Report Type

MedInsight AI uses a generic router factory for all non-blood report types. To add a new report type:

1. **Create the Mongoose model** in `server/models/`:
   ```javascript
   const mongoose = require("mongoose");
   const createGenericReportSchema = require("./genericReportSchema");
   const schema = createGenericReportSchema();
   module.exports = mongoose.model("YourReport", schema);
   ```

2. **Add the model to `server/index.js`** and create a router via `createGenericReportRouter`:
   ```javascript
   const YourReport = require("./models/yourReport");
   const yourRouter = createGenericReportRouter(YourReport, "Your Report Type");
   app.use("/api/yourreport", yourRouter);
   ```

3. **Add expected biomarkers** to `REPORT_BIOMARKERS` in `server/services/biomarkerService.js`.

4. **Add biomarker entries** to `server/data/biomarkers.json` with descriptions, aliases, units, and reference ranges.

5. **Update the frontend** to include the new report type in the report selection dropdowns and conversation selectors.

---

## Environment Variables

Never hardcode credentials or secrets. All configurable values must come from environment variables. Add any new variables to:

- `server/.env` (development values)
- `.env.example` (documented placeholder)
- `DEPLOYMENT.md` (production configuration table)

---

## Running Tests

### Full API Integration Tests
Runs the full endpoint integration suite (requires server to be running on port 8080):
```bash
cd server
npm test
```

### RAG Integration Tests
Verifies the correctness of the vector search pipeline, semantic query retrieval, chunking, and isolation scopes (requires database connection):
```bash
cd server
node scripts/testRag.js
```

### Unit Tests
Run individual services, controllers, and models validation tests:
```bash
cd server

# Test RAG chunking logic
node tests/ragChunking.test.js

# Test ReportChunk schema validation
node tests/reportChunk.test.js

# Test embedding generation with rate limits & retries
node tests/embeddingService.test.js

# Test Gemini AI chat generation with RAG context
node tests/aiService.test.js

# Test upload route with mock RAG indexing
node tests/files.test.js
```

---

## Limitations and Future Improvements

These are known limitations that future contributors could address:

- **Scanned PDF support:** The PDF parser cannot extract text from image-based (scanned) PDFs. OCR integration (e.g. Tesseract.js) would be needed.
- **Real email delivery:** Email alerts are simulated to log files. Integration with an SMTP provider (SendGrid, AWS SES) would enable real notifications.
- **Multi-instance rate limiting:** The in-memory rate limiter does not work across multiple server instances. Replace with a Redis-backed limiter for horizontal scaling.
- **Account deletion:** Users cannot delete their own accounts. This is needed for GDPR/privacy compliance.
- **Refresh tokens:** JWT refresh token rotation would reduce the need for users to re-login and improve security.
- **Password reset:** No password reset flow is implemented.
- **Report sharing:** Reports are strictly private. A sharing/export feature could be valuable.
