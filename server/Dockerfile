# WingBuddy server — Cloud Run image (Next.js 16 standalone).
# Deploy: gcloud run deploy wing-buddy-server --source server \
#   --min-instances 1 --max-instances 1 --allow-unauthenticated --region us-west1
# max=1 is mandatory: a 2nd instance would split the in-memory session Map.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
# Standalone output bundles a minimal server + only the needed node_modules.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
