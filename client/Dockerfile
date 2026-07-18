# WingBuddy — Cloud Run + Vercel deployable.
# Hour 1 scaffold image. Cloud Run is the primary target (in-memory session
# store is safe only with a single warm container).

FROM node:22-slim AS base
ENV NODE_ENV=production

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time env (safe names only; secrets injected at runtime).
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ----
FROM base AS runtime
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 8080
CMD ["npm", "run", "start"]
