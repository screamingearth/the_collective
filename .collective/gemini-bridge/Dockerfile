# Gemini Bridge - Dockerfile
# Purpose: Containerized Google Gemini MCP Bridge for AI research queries
# Uses: node:22-alpine for minimal footprint

FROM node:22-alpine AS builder

# Install build dependencies for native modules (python3, make, g++)
# Required by tree-sitter-bash and other native dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first (layer caching optimization)
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci
COPY src ./src
RUN npm run build

# Production stage - minimal runtime image
FROM node:22-alpine

WORKDIR /app

# Copy built artifacts and production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Create volume mount point for auth tokens
RUN mkdir -p /config

# Gemini bridge listens on port 3101 for SSE transport
EXPOSE 3101

# Health check: verify server responds
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3101/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run server with config path in volume
CMD ["node", "dist/mcp-server.js"]
