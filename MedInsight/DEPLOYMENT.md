# Deployment Guide

This guide covers deploying MedInsight AI to a production environment. The application is built to run as a single Node.js process serving both the REST API and the pre-built React frontend.

---

## Prerequisites

- Node.js v16+ on the server
- A MongoDB Atlas cluster (or self-hosted MongoDB instance)
- A Google Gemini API key
- A Cloudinary account (recommended for file storage)
- A Linux server, cloud VM (e.g. AWS EC2, GCP Compute Engine, DigitalOcean Droplet), or a PaaS platform (e.g. Railway, Render, Fly.io)

---

## Required Environment Variables

All variables below must be set in the production environment. The server will refuse to start if any of the critical ones are missing.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | Must be `production` |
| `MONGODB_URI` | Yes | Full MongoDB Atlas connection string |
| `JWTPRIVATEKEY` | Yes | Strong random secret key for JWT signing (min 32 chars recommended) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `CLIENT_URL` | Yes | The public HTTPS URL of the frontend (e.g. `https://yourdomain.com`). Comma-separate multiple origins if needed. |
| `PORT` | No | Server port (default: `8080`) |
| `SALT` | No | bcrypt salt rounds (default: `10`) |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret |
| `JWT_EXPIRATION` | No | JWT token expiry (default: `7d`) |
| `LOG_LEVEL` | No | Winston log level (default: `info`) |
| `MONGODB_MAX_POOL_SIZE` | No | MongoDB connection pool size (default: `10`) |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | No | DB server selection timeout in ms (default: `5000`) |
| `MONGODB_SOCKET_TIMEOUT_MS` | No | DB socket timeout in ms (default: `45000`) |
| `MONGODB_AUTO_INDEX` | No | Set to `false` in production (default: auto) |
| `MONGODB_RETRY_ATTEMPTS` | No | DB connection retry attempts (default: `5`) |
| `MONGODB_RETRY_DELAY_MS` | No | DB retry delay in ms (default: `5000`) |
| `OVERRIDE_CONSOLE` | No | Set to `true` to route all console calls through Winston |

---

## Step-by-Step Production Deployment

### Step 1: Provision the Server

Choose a cloud provider and create a server or deploy to a PaaS. Ensure Node.js v16+ is installed.

```bash
node --version
npm --version
```

### Step 2: Clone the Repository

```bash
git clone <your-repo-url>
cd MedInsight
```

### Step 3: Set Environment Variables

Create the `server/.env` file on the server (or set environment variables through your PaaS dashboard):

```bash
cp .env.example server/.env
nano server/.env
```

Fill in all production values. **Never commit `.env` to version control.**

### Step 4: Install Dependencies

```bash
cd server && npm install --omit=dev
cd ../client && npm install
```

### Step 5: Build the React Frontend

```bash
cd client
npm run build
```

This creates an optimized static build in `client/build/`. The Express server will serve this directory in production mode.

### Step 6: Start the Server

```bash
cd server
NODE_ENV=production npm start
```

Or with a process manager (recommended):

```bash
npm install -g pm2
pm2 start index.js --name medinsight-server --env production
pm2 save
pm2 startup  # configure auto-restart on server reboot
```

### Step 7: Configure a Reverse Proxy (Recommended)

Use Nginx or Caddy to terminate TLS and proxy requests to the Node.js server.

**Nginx example config:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    client_max_body_size 20M;  # Allow large PDF uploads

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## MongoDB Atlas Setup

1. Create a free or paid cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a database user with `readWrite` permissions on your database.
3. Whitelist your server's IP address (or use `0.0.0.0/0` for testing, not recommended for production).
4. Copy the connection string from Atlas and set it as `MONGODB_URI`.
5. The connection string format: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority`

---

## Cloudinary Setup

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. From your Cloudinary dashboard, copy the **Cloud Name**, **API Key**, and **API Secret**.
3. Set these as `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `.env`.

Without Cloudinary, files are saved to `server/uploads/` on the local filesystem. This is acceptable for development but not recommended for production (files are lost on server restart/redeploy).

---

## Docker Deployment (Optional)

### Server Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY client/build/ ./client/build/

WORKDIR /app/server

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "index.js"]
```

### Docker Build and Run

```bash
# 1. Build the React frontend first
cd client && npm install && npm run build && cd ..

# 2. Build the Docker image
docker build -t medinsight-server .

# 3. Run the container
docker run -d \
  --name medinsight \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e MONGODB_URI="mongodb+srv://..." \
  -e JWTPRIVATEKEY="your-strong-secret" \
  -e GEMINI_API_KEY="your-gemini-key" \
  -e CLIENT_URL="https://yourdomain.com" \
  -e CLOUDINARY_CLOUD_NAME="your_cloud" \
  -e CLOUDINARY_API_KEY="your_key" \
  -e CLOUDINARY_API_SECRET="your_secret" \
  medinsight-server
```

---

## Deployment Verification

After deploying, verify the application is running correctly:

1. **Health Check**
   ```bash
   curl https://yourdomain.com/health
   # Expected: { "status": "UP", ... }
   ```

2. **API Reachability**
   ```bash
   curl -X POST https://yourdomain.com/api/auth \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"wrongpassword"}'
   # Expected: 401 { "message": "Invalid Email or Password" }
   ```

3. **Frontend Loads**
   Open `https://yourdomain.com` in a browser — the login page should load.

4. **CORS Check**
   Ensure the `CLIENT_URL` in your environment exactly matches the URL used in the browser (including protocol and no trailing slash).

5. **Log Inspection**
   ```bash
   # With PM2
   pm2 logs medinsight-server

   # Or check log files
   tail -f server/logs/combined.log
   tail -f server/logs/error.log
   ```

---

## Security Checklist for Production

- [ ] `NODE_ENV=production` is set
- [ ] `JWTPRIVATEKEY` is a long, random, unpredictable string (use `openssl rand -base64 64`)
- [ ] `CLIENT_URL` is set to the actual production frontend URL only
- [ ] MongoDB Atlas IP whitelist is restricted to known server IPs
- [ ] Cloudinary is configured (no local file storage in production)
- [ ] HTTPS is enabled via reverse proxy (Nginx + Let's Encrypt)
- [ ] `.env` file is NOT committed to version control
- [ ] `MONGODB_AUTO_INDEX=false` in production
- [ ] Server logs are monitored (PM2 or equivalent)

---

## Updating the Application

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
cd server && npm install --omit=dev
cd ../client && npm install

# 3. Rebuild the frontend
cd client && npm run build

# 4. Restart the server
pm2 restart medinsight-server
```
