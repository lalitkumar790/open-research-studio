# Production container for Open Research Studio + Tectonic.
# Build: docker build -t open-research-studio .
# Run:   docker run --rm -p 3000:3000 open-research-studio
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Tectonic's current prebuilt Linux binary requires GLIBC 2.39.
# Ubuntu 24.04 (Noble) provides GLIBC 2.39; Bookworm only provides 2.36.
FROM node:20-noble-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl libfontconfig1 libfreetype6 libharfbuzz0b \
    libicu74 libgraphite2-3 libpng16-16 libssl3t64 \
    && rm -rf /var/lib/apt/lists/*

# Install the official prebuilt Tectonic executable.
RUN mkdir -p /tmp/tectonic-install && cd /tmp/tectonic-install \
    && curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
    && install -m 0755 tectonic /usr/local/bin/tectonic \
    && rm -rf /tmp/tectonic-install

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN useradd --system --uid 1001 nextjs \
    && mkdir -p /tmp/ors-tex-cache \
    && chown -R nextjs:nextjs /app /tmp/ors-tex-cache
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
