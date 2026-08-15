[![Live Demo](https://img.shields.io/badge/Live-Demo-blue)](https://medinsight-frontend-3ky7.onrender.com)

# MedInsight AI

MedInsight AI is a web application that helps you analyze medical lab reports (like blood tests or urine analysis) in PDF format. It automatically extracts key health biomarkers, checks them against standard reference ranges, maps trends over time, and includes an AI-powered chat assistant to answer questions about specific reports.


## Features

- **PDF Lab Report Parser**: Upload a machine-readable PDF medical report to automatically extract biomarker names and values.
- **Biomarker Range Checker**: Compares extracted values against a built-in database to classify them as Normal, High, Low, or Not Mentioned.
- **Historical Trend Charts**: Visualizes how your biomarker values change across multiple reports using interactive line charts.
- **AI Chat Assistant**: Ask questions about your report in plain language. The assistant (powered by Google Gemini) gives answers grounded in that specific report.
- **Health Profiles**: Store personal information (age, height, weight, and avatar) to help put your lab results in context.
- **Light & Dark Theme**: Toggle between light and dark modes instantly.

## Tech Stack

- **Frontend**: React (v18), React Router (v6), Recharts (for trend graphs), Axios (for API requests), React Icons.
- **Backend**: Node.js, Express, MongoDB (using Mongoose).
- **AI**: Google Gemini API (using `@google/genai`).
- **File Storage**: Local filesystem fallback (with optional Cloudinary configuration for production).

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

### Vector Search Index Setup
For full RAG functionality using semantic retrieval, you must create a Vector Search index in MongoDB Atlas. If running on local MongoDB, the application automatically falls back to fetching recent chunks using standard B-Tree indexes.
To configure the Atlas Vector Search Index automatically:
```bash
node MedInsight/server/scripts/createVectorIndex.js
```
Alternatively, you can create it manually on the `reportchunks` collection in MongoDB Atlas with the index name `reportchunks` using the following definition:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    },
    {
      "type": "filter",
      "path": "reportId"
    }
  ]
}
```

### Known Engineering Challenges Solved
- **Cross-Report Data Leakage:** Solved an issue where the retrieval step omitted the `reportId` filter, causing search queries to leak context from historical reports into the current active chat.
- **Biomarker Value Misattribution:** Fixed a bug where values with similar names (e.g., pH in Urinalysis vs. pH in Stool Analysis) were cross-contaminated by grouping chunks strictly by their biomarker panel.

## Environment Variables

To run the backend server, you need to configure environment variables. Copy the `.env.example` template into a new `.env` file in the backend directory:

```bash
cp MedInsight/.env.example MedInsight/server/.env
```

Open the new `MedInsight/server/.env` file and set the following required keys:

- `MONGODB_URI`: The connection URI for your MongoDB database (e.g., `mongodb://localhost:27017/medinsight`).
- `JWTPRIVATEKEY`: A secret key used to sign and secure session tokens.
- `GEMINI_API_KEY`: Your Gemini API key from Google AI Studio.
- `CLIENT_URL`: The URL of your React frontend for CORS validation (e.g., `http://localhost:3000`).

*(Optional)* If you want to store uploaded PDFs and avatars in the cloud, configure your Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`). Otherwise, they will save locally to `MedInsight/server/uploads/`.

## Installation

Install the package dependencies for both the backend server and frontend client:

```bash
# Install server dependencies
cd MedInsight/server
npm install

# Install client dependencies
cd ../client
npm install
```

## Running the Project

You can run the application locally or through Docker.

### Running Locally

First, ensure your MongoDB service is running. Then start both servers:

1. **Start the Backend Server (runs on Port 8080):**
   ```bash
   cd MedInsight/server
   npm run dev
   ```
2. **Start the Frontend Client (runs on Port 3000):**
   ```bash
   cd MedInsight/client
   npm start
   ```
   Now visit `http://localhost:3000` in your web browser.

### Running with Docker Compose

If you prefer to run the application using Docker:

```bash
docker-compose up --build
```
This builds the client and server containers and spins up a local MongoDB database. The app will be accessible at `http://localhost:5000`.

## Project Structure

```text
MedInsight/
├── client/           # React frontend application
│   ├── public/       # Static public files
│   └── src/          # Components, contexts, and styles
└── server/           # Node.js / Express backend server
    ├── controllers/  # API route request handlers
    ├── models/       # Mongoose schemas for MongoDB databases
    ├── routes/       # Express routing endpoints
    ├── services/     # Business logic (Gemini API, notifications, parsing)
    └── data/         # Biomarker reference range JSON database
```

## Available Scripts

### Frontend (`MedInsight/client`)
- `npm start`: Runs the frontend in development mode on `http://localhost:3000`.
- `npm run build`: Compiles the React build files into the `build/` folder for production.

### Backend (`MedInsight/server`)
- `npm run dev`: Starts the Express server in development mode using `nodemon` for auto-reloads.
- `npm start`: Starts the Express server directly.
- `npm test`: Runs the automated integration tests.

## Deployment

For production deployments (like on Render):
1. Build the frontend client with `npm run build`.
2. Configure the server environment with `NODE_ENV=production`.
3. Start the backend with `npm start`. In production, the backend automatically serves the static React files from `client/build` and runs unified on port `5000` (or your configured `PORT`).

A `render.yaml` template file is included in the project root for deployment on Render.

## License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).
