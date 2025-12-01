# ============================================================================
# LifeOS Frontend Dockerfile
# Multi-stage build for optimized production image
# ============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# ============================================================================
# Stage 2: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ARG NEXT_PUBLIC_AUTH0_AUDIENCE

# Set build-time environment variables
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID
ENV NEXT_PUBLIC_AUTH0_AUDIENCE=$NEXT_PUBLIC_AUTH0_AUDIENCE
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application
RUN yarn build

# ============================================================================
# Stage 3: Production
FROM node:20-alpine AS runner

# Add security updates
RUN apk update && apk upgrade && \
    apk add --no-cache tini && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create health check script
RUN echo 'const http = require("http"); \
const options = { host: "localhost", port: 3000, path: "/", timeout: 2000 }; \
const req = http.request(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
req.on("error", () => process.exit(1)); \
req.end();' > /app/healthcheck.js

# Switch to non-root user
USER nextjs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node /app/healthcheck.js

# Use tini
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "server.js"]