# --- Сборка приложения (standalone) ---
# docker compose up --build
#
# По умолчанию база — зеркало Google (тот же официальный library/node), чтобы реже ловить
# TLS timeout к registry-1.docker.io. Свой образ: docker build --build-arg NODE_IMAGE=node:20-alpine ...
#
# Только образ приложения:
# docker build -t kitsune-app --target runner .

ARG NODE_IMAGE=mirror.gcr.io/library/node:20-alpine
FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Зависимости для drizzle-kit migrate (отдельный target)
FROM base AS migrate
COPY package.json package-lock.json ./
RUN npm ci
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/server/db ./src/server/db
ENTRYPOINT ["npx", "drizzle-kit", "migrate"]

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Во время next build не требуем полный .env (см. src/lib/env.ts)
ENV SKIP_ENV_VALIDATION=1

ARG DATABASE_URL=postgresql://kitsune:kitsune@127.0.0.1:5432/kitsune
ENV DATABASE_URL=$DATABASE_URL
ENV NEXTAUTH_SECRET=build-time-placeholder-min-32-chars-for-next-auth
ENV NEXTAUTH_URL=http://127.0.0.1:3000
ENV NODE_ENV=production

RUN npm run build

FROM base AS runner
# ffmpeg для транскода 720p/480p (Alpine)
RUN apk add --no-cache ffmpeg
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV FFMPEG_PATH=/usr/bin/ffmpeg

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Запасной бинарник ffmpeg (если не Alpine / не системный PATH)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/ffmpeg-static ./node_modules/ffmpeg-static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
