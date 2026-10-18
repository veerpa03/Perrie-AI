# Multi-stage build for Perrie's custom server (Next.js + the Twilio
# media-stream WebSocket, run together via `tsx server/index.ts` — see
# server/index.ts). Works on any container platform that reads $PORT and
# routes to 0.0.0.0: Railway, Render, Fly, or a plain `docker run`.

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at runtime — Railway's service variables are only visible to the
# running container, not to `docker build`, so this must be re-declared as
# a build ARG and forwarded into ENV for `pnpm build` to pick it up. Railway
# auto-passes all service variables as build args to Dockerfile builds; it
# just needs a matching ARG here to actually use one.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN pnpm build

# The runtime image keeps the full node_modules (tsx/typescript are
# devDependencies but `pnpm start` needs tsx to run the TS server entrypoint
# directly — same as local dev) and the app/src/server source trees, since
# the custom server imports them at runtime rather than from a compiled
# bundle. Only the build-only inputs (References/, tests, scripts) are left
# out via .dockerignore / not copied below.
FROM node:22-alpine AS runner
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/src ./src
COPY --from=builder /app/server ./server
COPY --from=builder /app/middleware.ts ./middleware.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.npmrc ./.npmrc

EXPOSE 3000
# Invoke tsx directly instead of `pnpm start`: identical behavior (same
# command the start script runs), but skips pnpm's own startup overhead —
# a network-dependent package-manager version check and a lockfile/build-
# script re-verification pass — on every single container boot/restart.
CMD ["node_modules/.bin/tsx", "server/index.ts"]
