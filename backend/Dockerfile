# ============================================================================
# LifeOS Backend Dockerfile
# Multi-stage build for optimized production image
# ============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build TypeScript
RUN yarn build

# Remove dev dependencies
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# ============================================================================
# Stage 2: Production
FROM node:20-alpine

# Add security updates
RUN apk update && apk upgrade && \
    apk add --no-cache tini dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Health check script
COPY --chown=nodejs:nodejs <<EOF /app/healthcheck.js
const http = require('http');
const options = {
  host: 'localhost',
  port: process.env.PORT || 8000,
  path: '/health',
  timeout: 2000
};
const req = http.request(options, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.end();
EOF

# Switch to non-root user
USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node /app/healthcheck.js

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/server.js"]