# -------------------------------------------------
# 1️⃣  Build the React frontend (first stage)
# -------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files and install *all* deps (dev + prod) – needed for Vite build
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build            # → ./dist

# -------------------------------------------------
# 2️⃣  Build the backend (second stage) – final image
# -------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app/backend

# Install only runtime deps for the API
COPY backend/package*.json ./
RUN npm ci --production

COPY backend/ .

# Bring the compiled UI into the backend’s public folder
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 8080
CMD ["node", "src/index.js"]