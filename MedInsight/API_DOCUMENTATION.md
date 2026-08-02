# API Documentation

All API endpoints are prefixed with `/api`. All authenticated routes require the `Authorization: Bearer <token>` header.

**Base URL (local):** `http://localhost:8080`

---

## Authentication

### POST /api/auth — Login

Login and receive a JWT token.

**Auth required:** No  
**Rate limit:** 50 req / 15 min per IP

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword1!"
}
```

**Success response** `200 OK`:
```json
{
  "data": "<JWT token string>",
  "message": "logged in successfully"
}
```

**Error responses:**

| Status | Message |
|---|---|
| 400 | Validation error (email or password missing/invalid format) |
| 401 | `"Invalid Email or Password"` |
| 500 | `"Internal Server Error"` |

---

## Users

### POST /api/users — Register

Create a new user account.

**Auth required:** No  
**Rate limit:** 20 req / 15 min per IP

**Request body:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "SecurePassword1!",
  "age": 30,
  "height": "165cm",
  "weight": "60kg",
  "sex": "Female"
}
```

Password requirements: min 8 chars, max 128, at least 1 uppercase, 1 lowercase, 1 number, 1 symbol.

**Success response** `201 Created`:
```json
{ "message": "User created successfully!" }
```

**Error responses:**

| Status | Message |
|---|---|
| 400 | Joi validation error detail |
| 409 | `"Email already in use"` |
| 500 | `"Internal Server Error"` |

---

### GET /api/users/profile — Get Profile

**Auth required:** Yes

**Success response** `200 OK`:
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "age": 30,
  "height": "165cm",
  "weight": "60kg",
  "sex": "Female",
  "settings": {
    "theme": "light",
    "emailAlerts": true,
    "aiInsights": true,
    "autoAnomaly": true
  },
  "avatar": "https://res.cloudinary.com/..."
}
```

**Error responses:** `401`, `404`, `500`

---

### PUT /api/users/profile — Update Profile

**Auth required:** Yes

**Request body:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "age": 31,
  "height": "165cm",
  "weight": "62kg",
  "sex": "Female"
}
```

**Success response** `200 OK`:
```json
{
  "message": "Profile updated successfully!",
  "user": { "firstName": "Jane", ... }
}
```

**Error responses:** `400`, `401`, `404`, `500`

---

### POST /api/users/profile/avatar — Upload Avatar

**Auth required:** Yes  
**Content-Type:** `multipart/form-data`  
**Field name:** `avatar`  
**Allowed types:** JPEG, PNG, GIF, WebP  
**Max size:** 2 MB

**Success response** `200 OK`:
```json
{
  "message": "Avatar uploaded successfully",
  "avatarUrl": "https://res.cloudinary.com/..."
}
```

**Error responses:** `400` (no file, invalid type, too large), `401`, `404`, `500`

---

### PUT /api/users/profile/settings — Update Settings

**Auth required:** Yes

**Request body** (all fields optional):
```json
{
  "theme": "dark",
  "emailAlerts": false,
  "aiInsights": true,
  "autoAnomaly": true
}
```

**Success response** `200 OK`:
```json
{
  "theme": "dark",
  "emailAlerts": false,
  "aiInsights": true,
  "autoAnomaly": true
}
```

**Error responses:** `400`, `401`, `404`, `500`

---

## Files

### GET /api/files — List Uploaded Files

**Auth required:** Yes

**Success response** `200 OK`:
```json
[
  {
    "_id": "64abc...",
    "userId": "64abc...",
    "fileName": "blood_test.pdf",
    "filePath": "uploads/12345-blood_test.pdf",
    "publicId": "reports/12345-blood_test.pdf",
    "mimetype": "application/pdf",
    "uploadDate": "2024-01-15T10:30:00.000Z",
    "testDate": "2024-01-15T00:00:00.000Z",
    "description": "Annual checkup",
    "url": "http://localhost:8080/uploads/12345-blood_test.pdf"
  }
]
```

**Error responses:** `401`, `500`

---

### POST /api/files — Upload Report PDF

**Auth required:** Yes  
**Rate limit:** 15 req / 15 min per IP  
**Content-Type:** `multipart/form-data`  
**Field name:** `file`  
**Allowed type:** `application/pdf`  
**Max size:** 15 MB

**Additional form fields** (optional):
- `description` — text description of the report
- `testDate` — ISO 8601 date string

**Success response** `201 Created`:
```json
{
  "message": "File uploaded and biomarker results extracted successfully!",
  "biomarkers": [
    {
      "testName": "Hemoglobin",
      "description": "Protein in red blood cells that carries oxygen.",
      "resultValue": 13.5,
      "unit": "g/dL",
      "referenceRange": { "min": 12.0, "max": 16.0 },
      "status": "Normal"
    }
  ],
  "fileId": "64abc..."
}
```

**Error responses:**

| Status | Cause |
|---|---|
| 400 | No file, wrong file type, file too large |
| 401 | Missing or invalid token |
| 429 | Rate limit exceeded |
| 500 | PDF parse error, storage upload failure, internal error |

---

### DELETE /api/files/:id — Delete File and Associated Reports

**Auth required:** Yes

**URL parameter:** `:id` — MongoDB ObjectId of the file

**Success response** `200 OK`:
```json
{ "message": "File deleted successfully!" }
```

**Behaviour:** Deletes the file from Cloudinary/local storage and removes all associated biomarker report documents from all 6 report collections.

**Error responses:** `400` (invalid ID), `401`, `404`, `500`

---

## Generic Report Endpoints

The following endpoint patterns apply to all 5 non-blood report types:

| Report Type | Base Path |
|---|---|
| Urine Analysis | `/api/urinereport` or `/api/urineTests` |
| Stool Test | `/api/stoolreport` or `/api/stoolTest` |
| Semen Analysis | `/api/semenanalysis` or `/api/spermAnalysis` |
| Pap Smear | `/api/papsmear` or `/api/papSmears` |
| Swab Test | `/api/swabtest` or `/api/swabTest` |

Blood reports use `/api/bloodreport` (separate minimal router).

---

### POST /<reportBase>/ — Save Report

**Auth required:** Yes

**Request body:**
```json
{
  "reportDate": "2024-01-15",
  "biomarkers": [
    {
      "testName": "Hemoglobin",
      "resultValue": 13.5,
      "unit": "g/dL",
      "referenceRange": { "min": 12.0, "max": 16.0 },
      "status": "Normal",
      "description": "Carries oxygen in red blood cells"
    }
  ],
  "description": "Annual CBC",
  "fileId": "64abc..."
}
```

**Success response** `201 Created`:
```json
{
  "message": "Blood Test report saved successfully!",
  "report": { "_id": "...", "userId": "...", "reportDate": "...", "biomarkers": [...] }
}
```

**Error responses:** `400`, `401`, `500`

---

### GET /<reportBase>/biomarkers — Get Latest Biomarkers

Returns the most recent value for each expected biomarker. Biomarkers not found in any report are returned with `status: "Not Mentioned"`.

**Auth required:** Yes

**Success response** `200 OK`:
```json
[
  {
    "name": "Hemoglobin",
    "description": "...",
    "result": 13.5,
    "unit": "g/dL",
    "referenceRange": { "min": 12.0, "max": 16.0 },
    "status": "Normal",
    "reportDate": "2024-01-15T00:00:00.000Z"
  }
]
```

**Error responses:** `401`, `404`, `500`

---

### GET /<reportBase>/latest — Get Most Recent Report

**Auth required:** Yes

**Success response** `200 OK`: Full report document from MongoDB.

**Error responses:** `401`, `404`, `500`

---

### GET /<reportBase>/history/:biomarker — Get Biomarker History

Returns all historical values for a single named biomarker.

**Auth required:** Yes  
**URL parameter:** `:biomarker` — exact biomarker name (case-insensitive match)

**Success response** `200 OK`:
```json
[
  {
    "date": "1/15/2024",
    "value": 13.5,
    "unit": "g/dL",
    "normalRange": { "min": 12.0, "max": 16.0 },
    "description": "Carries oxygen in red blood cells"
  }
]
```

**Error responses:** `400`, `401`, `404`, `500`

---

### GET /<reportBase>/llm/insights — Get LLM Insights Data

Returns structured report data (most recent + historical) formatted for AI consumption.

**Auth required:** Yes

**Success response** `200 OK`:
```json
{
  "mostRecent": { "_id": "...", "reportDate": "...", "biomarkers": [...] },
  "historical": {
    "Hemoglobin": [
      { "date": "2024-01-15T00:00:00.000Z", "value": 13.5, "unit": "g/dL" }
    ]
  }
}
```

**Error responses:** `401`, `404`, `500`

---

## Conversations

### GET /api/conversations/reports — List Reports for Chat Selector

**Auth required:** Yes

Returns all user reports across all 6 types, sorted by date descending. Used to populate the report selector in the chatbot UI.

**Success response** `200 OK`:
```json
{
  "reports": [
    {
      "_id": "64abc...",
      "reportDate": "2024-01-15T00:00:00.000Z",
      "reportType": "Blood Test",
      "description": "Annual CBC",
      "fileName": "blood_test.pdf"
    }
  ]
}
```

---

### GET /api/conversations/user — List User Conversations

**Auth required:** Yes

**Success response** `200 OK`:
```json
{
  "conversations": [
    { "conversationID": "conv-uuid", "topic": "CBC Analysis", "messages": [...] }
  ]
}
```

---

### GET /api/conversations/conversation/:conversationID — Get Conversation Messages

**Auth required:** Yes

**Success response** `200 OK`: Array of message objects with `sender`, `message`, `timestamp`.

---

### POST /api/conversations/chat — Send Chat Message

**Auth required:** Yes  
**Rate limit:** 30 req / 15 min per IP

**Request body:**
```json
{
  "message": "Is my hemoglobin level normal?",
  "messages": [
    { "sender": "user", "text": "Is my hemoglobin level normal?" }
  ],
  "reportId": "64abc...",
  "conversationID": "conv-uuid-123",
  "topic": "CBC Analysis"
}
```

**Success response** `200 OK`:
```json
{ "botResponse": "Your Hemoglobin is 13.5 g/dL, which falls within the normal range of 12.0–16.0 g/dL." }
```

**Error responses:** `400`, `401`, `429`, `500`

---

### DELETE /api/conversations/conversation/:conversationID — Delete Conversation

**Auth required:** Yes

**Success response** `200 OK`: `{ "message": "Conversation deleted successfully" }`

---

### DELETE /api/conversations/clear — Clear All Conversations

**Auth required:** Yes

**Success response** `200 OK`: `{ "message": "All conversations cleared successfully" }`

---

## Notifications

### GET /api/notifications

**Auth required:** Yes

Returns all notifications, sorted newest first.

**Success response** `200 OK`: Array of notification objects.

---

### PUT /api/notifications/:id/read

**Auth required:** Yes  
Mark a single notification as read.

---

### PUT /api/notifications/read-all

**Auth required:** Yes  
Mark all notifications as read.

**Success response** `200 OK`: `{ "message": "All notifications marked as read" }`

---

### DELETE /api/notifications/:id

**Auth required:** Yes  
Dismiss (delete) a single notification.

---

### DELETE /api/notifications

**Auth required:** Yes  
Clear all notifications for the user.

---

## Activities

### GET /api/activities

**Auth required:** Yes

Returns all activities, sorted newest first. If no upload activities exist but the user has file records, activities are automatically seeded from existing data (one-time backfill).

**Query parameters:**
- `type` (optional) — filter by activity type: `upload`, `analysis`, `alert`, `delete`, `profile`, `settings`

**Success response** `200 OK`: Array of activity objects.

---

### POST /api/activities

**Auth required:** Yes  
Manually log a custom activity.

**Request body:**
```json
{
  "activityType": "upload",
  "title": "Manual Upload",
  "description": "Manually triggered upload activity.",
  "status": "Completed"
}
```

---

## Health Check

### GET /health or GET /api/health

**Auth required:** No

**Success response** `200 OK` (database connected):
```json
{
  "status": "UP",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 12345.678,
  "services": {
    "database": {
      "status": "UP",
      "details": { "readyState": 1 }
    }
  },
  "system": {
    "platform": "linux",
    "arch": "x64",
    "memory": {
      "free": 1073741824,
      "total": 8589934592,
      "usagePercent": "87.50"
    },
    "cpu": { "loadavg": [0.5, 0.4, 0.3] }
  }
}
```

**Error response** `503 Service Unavailable` (database down): Same structure with `"status": "DOWN"`.

---

## Common Error Codes

| Status | Meaning |
|---|---|
| 400 | Bad Request — validation error in request body, params, or query |
| 401 | Unauthorized — no token, invalid token, or expired token |
| 404 | Not Found — resource does not exist or does not belong to the authenticated user |
| 409 | Conflict — e.g., email already registered |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error — unexpected server error |
| 503 | Service Unavailable — database is disconnected (health check only) |
