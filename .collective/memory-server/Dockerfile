# Memory Server - Dockerfile
# Purpose: Containerized MCP Memory Server with semantic search capabilities
# Uses: node:22-slim (debian-based) for ML model compatibility with ONNX Runtime

FROM node:22-slim AS builder

# Install build dependencies for native modules (better-sqlite3, DuckDB)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (layer caching optimization)
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci
COPY src ./src
RUN npm run build

# Production stage - minimal runtime image
FROM node:22-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    sqlite3 \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts and production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Create volume mount point for persistent database
RUN mkdir -p /data

# Memory server listens on port 3100 for SSE transport
EXPOSE 3100

# Health check: verify server responds
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run server with database path in volume
CMD ["node", "dist/index.js"]
