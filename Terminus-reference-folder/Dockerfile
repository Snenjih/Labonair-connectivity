# Multi-architecture build support
ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETARCH
ARG TARGETVARIANT

# ============================================
# Base Build Stage - Common for all variants
# ============================================
FROM node:22-slim AS base-build

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code and build configurations
COPY src ./src
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY components.json ./

# ============================================
# Backend Build Stage
# ============================================
FROM base-build AS backend-build

# Build only backend
RUN npm run build:backend

# ============================================
# Web Build Stage (Frontend + Backend)
# ============================================
FROM base-build AS web-build

# Build both frontend and backend
RUN npm run build

# ============================================
# Full Build Stage (Web + Electron)
# ============================================
FROM base-build AS full-build

# Copy Electron files
COPY electron ./electron
COPY electron-builder.json ./
COPY scripts ./scripts

# Build web assets first
RUN npm run build

# Build Electron packages for multiple platforms
# Note: This may take significant time and disk space
RUN npm run build:linux-appimage && \
    npm run build:linux-targz && \
    mkdir -p /electron-builds && \
    cp -r release/* /electron-builds/ 2>/dev/null || true

# ============================================
# Runtime Base - Common runtime configuration
# ============================================
FROM node:22-slim AS runtime-base

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETARCH
ARG TARGETVARIANT

WORKDIR /app

ENV NODE_ENV=production

# Install runtime dependencies for SSH operations and monitoring
RUN apt-get update && \
    apt-get install -y \
    openssh-client \
    iputils-ping \
    lm-sensors \
    ca-certificates \
    procps \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Display build information for debugging
RUN echo "Built for platform: ${TARGETPLATFORM}" && \
    echo "Architecture: ${TARGETARCH}${TARGETVARIANT}" && \
    echo "Build platform: ${BUILDPLATFORM}"

# ============================================
# VARIANT 1: Backend-Only Image
# Usage: For separate frontend deployments or as API server
# ============================================
FROM runtime-base AS backend

ENV PORT=30001
ENV DATA_DIR=/app/db/data
ENV IMAGE_VARIANT=backend

EXPOSE 30001
EXPOSE 8443

# Copy only backend build
COPY --from=backend-build /usr/src/app/dist/backend ./dist/backend
COPY --from=backend-build /usr/src/app/dist/types ./dist/types
COPY --from=backend-build /usr/src/app/package*.json ./
COPY scripts/healthcheck.js ./scripts/healthcheck.js

# Create necessary directories
RUN mkdir -p db/data uploads ssl

# Install only production dependencies
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# Health check for backend API (supports both HTTP and HTTPS)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node scripts/healthcheck.js

CMD ["node", "dist/backend/backend/starter.js"]

# ============================================
# VARIANT 2: Web Image (Backend + Frontend)
# Usage: Standard web deployment
# ============================================
FROM runtime-base AS web

ENV PORT=30001
ENV DATA_DIR=/app/db/data
ENV IMAGE_VARIANT=web

EXPOSE 30001
EXPOSE 8443

# Copy full web build (backend + frontend)
COPY --from=web-build /usr/src/app/dist ./dist
COPY --from=web-build /usr/src/app/package*.json ./
COPY scripts/healthcheck.js ./scripts/healthcheck.js

# Create necessary directories
RUN mkdir -p db/data uploads ssl

# Install only production dependencies
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# Health check for web application (supports both HTTP and HTTPS)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node scripts/healthcheck.js

CMD ["node", "dist/backend/backend/starter.js"]

# ============================================
# VARIANT 3: Full Image (Web + Electron Builds)
# Usage: Complete deployment with downloadable desktop apps
# ============================================
FROM runtime-base AS full

ENV PORT=30001
ENV DATA_DIR=/app/db/data
ENV IMAGE_VARIANT=full

EXPOSE 30001
EXPOSE 8443

# Copy full web build
COPY --from=full-build /usr/src/app/dist ./dist
COPY --from=full-build /usr/src/app/package*.json ./
COPY scripts/healthcheck.js ./scripts/healthcheck.js

# Copy Electron builds if available
COPY --from=full-build /electron-builds ./downloads 2>/dev/null || true

# Create necessary directories
RUN mkdir -p db/data uploads ssl downloads

# Install only production dependencies
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# Health check for full application (supports both HTTP and HTTPS)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node scripts/healthcheck.js

CMD ["node", "dist/backend/backend/starter.js"]

# ============================================
# Default target is 'web' for standard usage
# ============================================
FROM web AS default
