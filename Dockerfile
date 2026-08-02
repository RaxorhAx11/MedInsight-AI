# Build stage for client
FROM node:18-alpine as client-build
WORKDIR /app/client
COPY MedInsight/client/package*.json ./
RUN npm ci
COPY MedInsight/client/ ./

# Pass React API Base URL at build time (defaults to relative /api)
ARG REACT_APP_API_BASE_URL=/api
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

RUN npm run build

# Build stage for server
FROM node:18-alpine as server-build
WORKDIR /app/server
COPY MedInsight/server/package*.json ./
# Install only production dependencies
RUN npm ci --omit=dev
COPY MedInsight/server/ ./

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy built client files
COPY --from=client-build /app/client/build ./client/build

# Copy server files and dependencies
COPY --from=server-build /app/server ./server
COPY --from=server-build /app/server/node_modules ./server/node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose ports
EXPOSE 5000

# Start the server
WORKDIR /app/server
CMD ["node", "index.js"]