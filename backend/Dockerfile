# ── Build stage ──
FROM node:24-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
# Use `npm ci` when a lockfile is present for reproducible builds,
# otherwise fall back to `npm install` so builds without a lockfile still work.
RUN if [ -f package-lock.json ]; then \
            npm ci --include=optional --no-audit --no-fund; \
        else \
            npm install --include=optional --no-audit --no-fund; \
        fi

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ── Runtime stage ──
# Ubuntu 24.04 (glibc 2.39) required — Kreuzberg native binary needs glibc >= 2.38.
# node:24-slim is Debian 12 (glibc 2.36) which is incompatible.
FROM ubuntu:24.04
WORKDIR /app

# Copy Node.js runtime from official image
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
    RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    apt-get update && apt-get install -y --no-install-recommends \
        openssl ca-certificates postgresql-client \
        ocrmypdf tesseract-ocr tesseract-ocr-eng poppler-utils ghostscript && \
    rm -rf /var/lib/apt/lists/*

# Install production dependencies
COPY package.json package-lock.json* ./
# Prefer `npm ci` when possible; otherwise install normally.
RUN if [ -f package-lock.json ]; then \
            npm ci --omit=dev --include=optional --no-audit --no-fund; \
        else \
            npm install --omit=dev --include=optional --no-audit --no-fund; \
        fi

# Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Application code
# Copy built artifacts and dependencies from the builder stage to avoid
# running `npm install` at runtime (prevents network/download issues
# during image build and ensures the Prisma client binaries are present).
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY src/data ./dist/data
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 8000
CMD ["./entrypoint.sh"]
