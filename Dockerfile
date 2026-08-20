# syntax=docker/dockerfile:1.7

###############################################################################
# Telegram Bot Builder — production image
#
# Uch bosqich:
#   deps    — faqat bog'liqliklar (npm ci, deterministik)
#   builder — prisma generate + next build (standalone)
#   runner  — minimal runtime, non-root
#
# Alohida `migrator` bosqichi ham bor: u Prisma CLI'ni saqlaydi va compose'da
# bir martalik `migrate deploy` uchun ishlatiladi. Shu sababli asosiy runtime
# image'da Prisma CLI ham, devDependencies ham YO'Q.
#
# Sirlar image ichiga KIRMAYDI: hamma qiymat runtime'da environment orqali
# beriladi. Build vaqtida faqat NEXT_PUBLIC_* kerak bo'lishi mumkin.
###############################################################################

ARG NODE_VERSION=22-alpine

###############################################################################
# 1. deps — bog'liqliklar
###############################################################################
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Prisma engine'lari alpine'da OpenSSL talab qiladi.
RUN apk add --no-cache libc6-compat openssl

# Faqat manifestlarni ko'chiramiz — kod o'zgarganda bu qatlam qayta
# yig'ilmaydi va npm ci cache'dan foydalanadi.
COPY package.json package-lock.json ./

# `npm ci` — lockfile'ga qat'iy amal qiladi (deterministik build).
RUN --mount=type=cache,target=/root/.npm \
    npm ci

###############################################################################
# 2. builder — prisma generate + next build
###############################################################################
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client build'dan OLDIN generatsiya qilinadi — server komponentlari
# import qiladi.
RUN npx prisma generate

# Telemetriya production build'da keraksiz tarmoq chaqiruvi qiladi.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# `output: "standalone"` tufayli natija .next/standalone ichida.
RUN npm run build

###############################################################################
# 3. migrator — bir martalik `prisma migrate deploy` uchun
###############################################################################
FROM node:${NODE_VERSION} AS migrator
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# Prisma CLI va schema — migratsiya uchun shuning o'zi yetarli.
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY package.json ./

USER node
CMD ["npx", "prisma", "migrate", "deploy"]

###############################################################################
# 4. runner — minimal production runtime
###############################################################################
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Konteyner ichida 0.0.0.0 da tinglash SHART — aks holda port tashqaridan
# ko'rinmaydi.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# `node` foydalanuvchisi node image'da tayyor keladi (uid 1000).
# Root sifatida ishlatmaymiz.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

# Healthcheck ilovaning o'z endpointiga uradi. `wget` alpine'da tayyor.
# start-period build'dan keyingi birinchi ishga tushishga vaqt beradi.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# standalone rejimi o'z serverini yasaydi — `next start` emas.
CMD ["node", "server.js"]
