# -------------------------------------------------
# 1️⃣  Build the React frontend (first stage)
# -------------------------------------------------
FROM node:20-alpine AS frontend-builder

# Working directory for the frontend
WORKDIR /app/frontend

# Install only the packages needed to build the UI
COPY frontend/package*.json ./
RUN npm ci

# Copy the rest of the frontend source and build it
COPY frontend/ .
RUN npm run build            # produces ./dist

# -------------------------------------------------
# 2️⃣  Build the backend (second stage) – final image
# -------------------------------------------------
FROM node:20-alpine AS runtime

# Working directory for the backend
WORKDIR /app/backend

# Install backend runtime dependencies
COPY backend/package*.json ./
RUN npm ci --production      # only runtime deps

# Copy backend source code
COPY backend/ .

# Pull the compiled frontend assets into the backend’s public folder
# (Express is already configured to serve static files from ./public)
COPY --from=frontend-builder /app/frontend/dist ./public

# Expose the port Railway will assign via $PORT (default 8080)
EXPOSE 8080

# Start the Express API
CMD ["node", "src/index.js"]
