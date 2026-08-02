# Security Documentation

This document describes the security measures implemented in MedInsight AI, environment variable handling, known security considerations, and best practices.

---

## Authentication

### JWT-Based Stateless Authentication

- **Algorithm:** HS256 (HMAC SHA-256)
- **Secret:** `JWTPRIVATEKEY` environment variable
- **Default expiry:** 7 days (configurable via `JWT_EXPIRATION`)
- **Storage:** Client stores the token in `localStorage`
- **Transmission:** All authenticated requests include `Authorization: Bearer <token>` header

**Token verification** is performed in `middleware/auth.js`:

1. Extract the `Authorization` header.
2. Verify `Bearer ` prefix is present.
3. `jwt.verify(token, JWTPRIVATEKEY, { algorithms: ["HS256"] })` — strict algorithm pinning prevents algorithm substitution attacks.
4. Attach `req.user = decoded` on success.
5. Return `401` with an appropriate message on failure (expired vs. invalid).

---

## Authorization

All API endpoints that return or modify user data are protected by `authMiddleware`. Ownership is enforced by always filtering queries by `userId` from the verified JWT payload — not from request body or params. This prevents horizontal privilege escalation (user A accessing user B's data).

**Example pattern:**
```javascript
// Good — userId from verified token
const files = await File.find({ userId: req.user._id });

// Bad (not used) — userId from request body
const files = await File.find({ userId: req.body.userId }); 
```

---

## Password Security

- **Algorithm:** bcrypt
- **Salt rounds:** 10 (configurable via `SALT` env var)
- **Password policy enforced by Joi + joi-password-complexity:**
  - Minimum 8 characters, maximum 128 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 numeric character
  - At least 1 symbol character

**Timing attack prevention for login:**
When a user submits an email that doesn't exist in the database, the server still runs a dummy `bcrypt.compare()` call against a hardcoded hash. This ensures that the response time is identical whether the email exists or not, preventing email enumeration via timing analysis.

---

## HTTP Security Headers

Helmet is applied globally and sets the following headers:

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | Helmet default | Prevents XSS, clickjacking |
| `X-Frame-Options` | `SAMEORIGIN` | Prevents clickjacking via iframes |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `Referrer-Policy` | `no-referrer` | Limits referrer information leakage |
| `Strict-Transport-Security` | Set in production | Enforces HTTPS |
| `X-Powered-By` | *Removed* | Prevents Express version fingerprinting |
| `Cross-Origin-Resource-Policy` | `cross-origin` | Required for Cloudinary asset serving |

---

## CORS Configuration

CORS is configured to allow only explicitly whitelisted origins:

- **Production:** Only origins listed in the `CLIENT_URL` environment variable (comma-separated)
- **Development:** Additionally allows `http://localhost:3000`
- **Requests without `Origin` header** (same-origin, curl, mobile apps): always allowed
- **Credentials:** `credentials: true` is set, allowing cookies if needed in future

If a request arrives from an unlisted origin, Express throws a CORS error and returns `403`.

---

## Rate Limiting

The rate limiter is a custom in-memory implementation (`middleware/rateLimiter.js`) using an IP address map with periodic cleanup.

| Scope | Limit | Window |
|---|---|---|
| All `/api/*` routes (global) | 200 requests | 15 minutes |
| `POST /api/auth` (login) | 50 requests | 15 minutes |
| `POST /api/users` (registration) | 20 requests | 15 minutes |
| `POST /api/conversations/chat` | 30 requests | 15 minutes |
| `POST /api/files` (upload) | 15 requests | 15 minutes |

Rate limit exceeded response: `429 Too Many Requests` with `{ "message": "Too many requests from this IP, please try again in a few minutes." }`

> **Note:** The in-memory rate limiter does not persist across server restarts and is not shared across multiple server instances. For multi-instance deployments, replace with a Redis-backed solution (e.g. `express-rate-limit` with `ioredis`).

---

## Input Sanitization

`middleware/sanitize.js` is applied globally to all incoming requests. It recursively traverses `req.body`, `req.query`, and `req.params`, stripping:

1. Complete `<script>...</script>` blocks and their contents
2. All other HTML tags (e.g. `<img>`, `<a>`, `<div>`)

This provides basic XSS protection for stored string values. Joi validation runs after sanitization and further enforces correct data types and formats.

---

## Input Validation

All route handlers validate incoming request bodies using **Joi** before processing. Validation rules include:

- Type checking (string, number, date, boolean, ObjectId hex)
- Length limits
- Enum constraints
- Required vs. optional fields
- Email format validation
- MongoDB ObjectId format validation (24-char hex string)

Malformed requests are rejected with `400 Bad Request` before touching the database.

---

## File Upload Security

- **File type validation:** Multer `fileFilter` only accepts `application/pdf` for reports; `image/jpeg`, `image/png`, `image/gif`, `image/webp` for avatars.
- **File size limits:** 15 MB for reports, 2 MB for avatars.
- **In-memory storage:** Files are held in `Buffer` and never written to disk until cloud upload succeeds. Multer uses `memoryStorage()`.
- **Orphan cleanup:** If a file is uploaded to cloud storage but the database save fails, the uploaded file is deleted from storage before the error response is returned.

---

## Error Response Sanitization

In production (`NODE_ENV=production`), all `500`-level errors return only the generic message:

```json
{ "message": "Internal Server Error" }
```

Stack traces and internal error details are logged server-side (Winston) but never included in API responses.

In non-production environments, the actual error message is returned to assist debugging.

---

## Environment Variable Security

| Variable | Sensitivity | Notes |
|---|---|---|
| `MONGODB_URI` | Critical | Contains DB credentials |
| `JWTPRIVATEKEY` | Critical | Compromise allows token forgery |
| `GEMINI_API_KEY` | High | Allows API usage at your billing cost |
| `CLOUDINARY_API_SECRET` | High | Allows full Cloudinary account access |
| `SALT` | Low | bcrypt salt factor, not secret |
| `PORT`, `NODE_ENV`, `LOG_LEVEL` | None | No security sensitivity |

**Rules:**
- Never commit `.env` files to version control.
- `.gitignore` excludes `/server/.env` and `/.env`.
- In production, set environment variables through your hosting platform's secret management, not through a file.
- Rotate `JWTPRIVATEKEY` periodically (requires users to re-login).

---

## Graceful Shutdown and Process Safety

The server handles `SIGINT` and `SIGTERM` signals with a graceful shutdown routine that:

1. Stops accepting new connections.
2. Waits for in-flight requests to complete.
3. Closes the Mongoose connection cleanly.
4. Exits with code `0` on success or `1` on error.
5. Forces exit after 10 seconds if graceful shutdown hangs.

Uncaught exceptions and unhandled promise rejections are caught globally and logged with Winston before triggering the graceful shutdown. This prevents the process from running in an unknown state.

---

## Known Security Considerations and Limitations

| Item | Details |
|---|---|
| JWT in localStorage | Susceptible to XSS attacks. Acceptable for the current SPA deployment model; consider `httpOnly` cookie storage for higher-security requirements. |
| In-memory rate limiter | Resets on restart; not shared across instances. Suitable for single-process deployments. |
| Email alerts simulated | No actual email is sent. Email content is logged to disk. If real email alerts are needed, integrate an SMTP provider (e.g. SendGrid, AWS SES). |
| No CSRF protection | The API is REST-based and uses `Authorization` headers (not cookies), so CSRF attacks do not apply to the current implementation. |
| Biomarker regex matching | PDF parsing relies on regex patterns. Unusual PDF layouts or heavily formatted reports may yield incorrect or missed biomarker extractions. |
| No account deletion endpoint | Users cannot delete their own account through the application. This would need to be implemented for GDPR/compliance requirements. |
