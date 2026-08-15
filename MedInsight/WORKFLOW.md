# Application Workflow

This document describes the complete end-to-end workflows for all major user-facing operations in MedInsight AI.

---

## 1. Authentication Flow

### Registration

```
User fills signup form
  → POST /api/users
  → Server validates body with Joi (firstName, lastName, email, password, age, height, weight, sex)
  → Password complexity checked (min 8 chars, uppercase, lowercase, numeric, symbol)
  → Check if email already exists in DB
  → bcrypt.hash(password, salt)
  → Save new User document to MongoDB
  → Return 201 { message: "User created successfully!" }
  → Frontend redirects to /login
```

### Login

```
User submits credentials
  → POST /api/auth
  → Server validates body (email, password)
  → Lookup user by email in MongoDB
  → If email not found: run dummy bcrypt.compare (timing attack prevention)
  → bcrypt.compare(inputPassword, storedHash)
  → If match: user.generateAuthToken() → JWT (HS256, 7d expiry)
  → Return 200 { data: "<JWT token>" }
  → Frontend stores token in localStorage
  → Frontend redirects to / (dashboard)
```

### Token Verification (all protected routes)

```
Client includes header: Authorization: Bearer <token>
  → middleware/auth.js extracts token
  → jwt.verify(token, JWTPRIVATEKEY, { algorithms: ["HS256"] })
  → If valid: attach decoded payload ({ _id }) to req.user
  → Call next() to proceed to route handler
  → If expired: return 401 { message: "Token expired. Please log in again." }
  → If invalid: return 401 { message: "Invalid authentication token." }
```

---

## 2. PDF Report Upload and Biomarker Extraction Workflow

```
User selects a PDF on the Upload page
  → POST /api/files (multipart/form-data, field: "file")
  → Multer: validate file (PDF only, max 15 MB), store in memory buffer
  → extractBiomarkerResults(buffer):
      1. pdf-parse with custom pagerender (preserves layout with tab characters)
      2. If initial parse fails (CRLF issue): retry with CRLF→LF conversion
      3. parseBiomarkers(text):
          a. Iterate over all entries in biomarkers.json (sorted by name length, longest first)
          b. For each biomarker: build regex from name + all aliases
          c. Try numeric match: extract result value, validate range (0 – 1e6)
          d. If value is orders of magnitude smaller than reference range: apply scale factor
          e. If no numeric match: try qualitative match (text result like "Negative")
          f. Clean up qualitative result (strip reference ranges, parenthetical notes)
          g. Call getBiomarkerStatus() to determine Normal/High/Low/Not Mentioned
          h. Push biomarker entry to results array
  → Upload file buffer to Cloudinary (if configured) or local uploads/ folder
  → Create File document in MongoDB (userId, fileName, filePath, publicId, mimetype, testDate)
  → Generate semantic chunks and embeddings for the report:
      1. Chunk the parsed PDF text and biomarker results by panel/category and doctor's notes (using ragChunking.js)
      2. Generate 768-dimension embeddings for each chunk using Google's gemini-embedding-2 model (using embeddingService.js)
      3. Save chunk documents (userId, reportId, chunkText, chunkType, embedding) in the reportchunks collection
  → Create notification: "New report uploaded successfully"
  → Log activity: type=upload
  → Return 201 { biomarkers: [...], fileId: "..." }
  → Frontend receives extracted biomarkers for review on AddReports page
```

---

## 3. Report Save Workflow

```
User reviews extracted biomarkers on AddReports page and clicks Save
  → Determine report type from PDF content/file name
  → POST /api/<reporttype> (e.g. /api/bloodreport, /api/urinereport, etc.)
  → Server validates body: reportDate, biomarkers array, optional description, optional fileId
  → filterAndMapBiomarkers(): filter biomarkers to only those expected for this report type
  → Create report document (userId, reportDate, biomarkers, description, fileId)
  → Save to appropriate collection (bloodreports, urinereports, etc.)
  → handleBiomarkerAnalysisNotifications():
      1. Create "AI analysis completed" notification
      2. Log analysis activity
      3. Scan biomarkers for High/Low status
      4. If anomalies found:
          a. Create "Abnormal biomarker values detected" warning notification
          b. Log health alert activity
          c. Create critical health alert notification
          d. If emailAlerts enabled in user settings:
             Write email simulation log to uploads/email_logs/
             Create "Email sent" success notification
          e. If emailAlerts disabled:
             Create "Email skipped (disabled in settings)" info notification
  → Return 201 { report: { ... } }
```

---

## 4. AI Chat Workflow

### Starting a Conversation

```
User opens /chat page
  → GET /api/conversations/reports → fetch all user reports for the report selector dropdown
  → User selects a report from the dropdown
  → GET /api/conversations/user → load all conversation summaries for sidebar
  → User types a message and submits
```

### Message Processing

```
User submits a message (with a selected reportId)
  → POST /api/conversations/chat
  → Body: { message, messages (chat history), reportId, conversationID, topic }
  → saveMessage(userId, conversationID, "user", message)
  → Fetch selected report:
      Loop through all 6 report model types
      Model.findOne({ _id: reportId, userId }) — ensures user ownership
      Stop at first match
  → If report found:
      1. Generate a 768-dimension embedding vector for the user's question using gemini-embedding-2
      2. Perform MongoDB Atlas Vector Search on the reportchunks collection:
         - index: "reportchunks"
         - filter: { userId: targetUserId, reportId: targetReportId }
         - limit: 5
      3. Fallback: If Atlas Vector Search fails, fetch the 5 most recent chunks for the report from database
      4. Format context: Group retrieved chunk text as SELECTED REPORT CONTEXT
      5. Align chat history to Gemini SDK role format (alternating user/model)
      6. Create chat session:
         ai.chats.create({ model: "gemini-3.6-flash", history, config: { systemInstruction (includes retrieved context) } })
      7. Send message: chat.sendMessage({ message: question })
  → saveMessage(userId, conversationID, "bot", botResponse)
  → Return { botResponse }
  → Frontend renders bot response (animated character by character)
```

### System Instruction (AI Context)

The AI is instructed to:
- Answer ONLY based on the selected report data provided in the system prompt.
- Never invent biomarker values, ranges, or diagnoses.
- If a value is not in the report, respond "Not mentioned in this report."
- Keep answers direct and focused on the user's query.

---

## 5. Biomarker Results and History Workflow

### Biomarker Overview (/reports/results)

```
User navigates to /reports/results
  → GET /api/<reporttype>/biomarkers for each report type
  → Server: fetch all reports for userId, sorted by reportDate descending
  → Build biomarkerMap: first occurrence of each biomarker name (most recent value)
  → Fill in expected biomarkers from REPORT_BIOMARKERS[reportType] list (status: "Not Mentioned")
  → Return ordered biomarker array
  → Frontend: display BiomarkerCard grid (color-coded by status)
```

### Individual Biomarker History (/reports/biomarker/:name)

```
User clicks on a biomarker card
  → GET /api/<reporttype>/history/:biomarkerName
  → Server: fetch all reports, extract value for this biomarker from each report
  → Return array of { date, value, unit, normalRange, description }
  → Frontend: display Recharts line chart with historical trend + reference range band
```

---

## 6. File Management Workflow

### List Files

```
User navigates to /reports/labreports
  → GET /api/files
  → Server: File.find({ userId }) with full URLs resolved (Cloudinary or local)
  → Return file list with URL, fileName, uploadDate, testDate, description
```

### Delete Report

```
User clicks delete on a report
  → DELETE /api/files/:id
  → Validate MongoDB ObjectId format
  → File.findOne({ _id, userId }) — verify ownership
  → deleteFile(filePath, publicId, type) → delete from Cloudinary or local disk
  → Build deleteQuery to match associated report documents:
      Match by fileId OR (matching date window ±24h AND no fileId)
  → Promise.all([BloodReport.deleteMany, UrineReport.deleteMany, ..., ReportChunk.deleteMany({ reportId: fileId })]) → delete all report and chunk data
  → File.deleteOne → delete the file record
  → Log delete activity
  → Return 200 { message: "File deleted successfully!" }
```

---

## 7. Profile and Settings Workflow

### Update Profile

```
User submits profile form on /profile
  → PUT /api/users/profile
  → Validate: firstName, lastName, age, height, weight, sex
  → User.findById(userId), update fields, save
  → Create notification: "Profile updated"
  → Log profile update activity
  → Return updated user object
```

### Upload Avatar

```
User selects an image on /profile
  → POST /api/users/profile/avatar (multipart, field: "avatar")
  → Multer: validate image type (jpeg/png/gif/webp), max 2 MB
  → uploadFile(buffer, name, mimetype, 'avatar') → Cloudinary or local uploads/avatars/
  → If user had a previous avatar (non-default): delete old file from storage
  → Update user.avatar = new URL
  → Create notification + log activity
  → Return { avatarUrl }
```

### Update Settings

```
User toggles settings on /profile
  → PUT /api/users/profile/settings
  → Validate: theme, emailAlerts, aiInsights, autoAnomaly
  → Merge with existing settings, save
  → Create notification + log activity
  → Return updated settings object
```

---

## 8. Notifications Workflow

```
Notifications are created automatically by:
  - File upload (type: success)
  - AI analysis completion (type: info)
  - Abnormal biomarker detected (type: warning + danger)
  - Email alert dispatched (type: success)
  - Profile update (type: success)
  - Settings update (type: success)

GET /api/notifications → fetch all user notifications, sorted newest first
PUT /api/notifications/:id/read → mark single notification as read
PUT /api/notifications/read-all → mark all as read
DELETE /api/notifications/:id → dismiss single notification
DELETE /api/notifications → clear all notifications
```

---

## 9. Activity Log Workflow

```
Activities are created automatically by:
  - File upload
  - AI analysis completion
  - Health alert detection
  - Profile update
  - Avatar upload
  - Settings update
  - File/report deletion

Auto-seeding: On first fetch of activities (GET /api/activities):
  If no upload activities exist AND the user has file records:
    Retroactively create upload + analysis + alert activities for all existing files

GET /api/activities → returns all user activities, sorted newest first
GET /api/activities?type=upload → filter by activityType
POST /api/activities → manually log a custom activity
```

---

## 10. Health Check Workflow

```
GET /health or GET /api/health (no authentication required)
  → Check mongoose.connection.readyState (0=disconnected, 1=connected)
  → Collect system info (platform, memory, CPU load average, uptime)
  → If DB disconnected: return 503 JSON with status "DOWN"
  → If DB connected: return 200 JSON with status "UP" + full metrics
```
