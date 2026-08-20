#!/usr/bin/env bash
#
# Qara — PostgreSQL zaxira nusxasi (§P5 PHASE 6).
#
#   ./scripts/backup-db.sh [papka]
#
# Docker compose ishlayotgan bo'lsa `db` konteyneridan, aks holda mahalliy
# `pg_dump` bilan oladi. Natija — siqilgan `custom` formatdagi dump
# (`pg_restore` bilan tanlab tiklash mumkin).
#
# MUHIM: dump ichida SIRLAR YO'Q — `.env`, tokenlar va API kalitlari
# bazaga SHIFRLANGAN holda yoziladi (AES-256-GCM, `SECRETS_KEY`).
# Ya'ni dump'ni tiklash uchun `SECRETS_KEY` ALOHIDA saqlanishi kerak.
# Kalitsiz dump'dan bot tokenlarini ochib bo'lmaydi.

set -euo pipefail

OUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="${OUT_DIR}/qara-${STAMP}.dump"

DB_USER="${POSTGRES_USER:-qara}"
DB_NAME="${POSTGRES_DB:-qara}"
CONTAINER="${POSTGRES_CONTAINER:-qara-postgres}"

mkdir -p "$OUT_DIR"

echo "→ zaxira: $FILE"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  echo "  manba: docker konteyneri '$CONTAINER'"
  # `-i` SHART: usiz Docker chiqish oqimini multipleks sarlavhalar bilan
  # aralashtirib yuboradi va dump buziladi.
  # `-Fc` — custom format: siqilgan va tanlab tiklanadi.
  docker exec -i "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$FILE"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "  manba: mahalliy pg_dump"
  : "${DATABASE_URL:?DATABASE_URL kerak (yoki docker konteynerini ishga tushiring)}"
  # Prisma `?schema=public` qo'shadi, `pg_dump` esa uni tushunmaydi.
  pg_dump "${DATABASE_URL%%\?*}" -Fc > "$FILE"
else
  echo "✗ na docker konteyneri, na pg_dump topildi" >&2
  exit 1
fi

# ── Tekshiruv ───────────────────────────────────────────────────────────────
# Bo'sh yoki buzuq dump zaxira EMAS. `pg_restore --list` faylni ocha
# olishini va ichida obyektlar borligini tasdiqlaydi.
SIZE=$(wc -c < "$FILE" | tr -d ' ')
if [ "$SIZE" -lt 1000 ]; then
  echo "✗ dump juda kichik ($SIZE bayt) — zaxira yaroqsiz" >&2
  rm -f "$FILE"
  exit 1
fi

if command -v pg_restore >/dev/null 2>&1; then
  OBJECTS=$(pg_restore --list "$FILE" 2>/dev/null | grep -c "TABLE DATA" || true)
  echo "  tekshiruv: $OBJECTS ta jadval ma'lumoti"
  if [ "${OBJECTS:-0}" -lt 1 ]; then
    echo "✗ dump ichida jadval ma'lumoti yo'q" >&2
    exit 1
  fi
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  # `/dev/stdin` BERILMAYDI: konteyner ichida u ishlamaydi va pg_restore
  # «did not find magic string» deb yiqiladi. Fayl nomisiz chaqirilganda
  # pg_restore stdin'ni o'zi o'qiydi.
  OBJECTS=$(docker exec -i "$CONTAINER" pg_restore --list < "$FILE" 2>/dev/null | grep -c "TABLE DATA" || true)
  echo "  tekshiruv: $OBJECTS ta jadval ma'lumoti"
  if [ "${OBJECTS:-0}" -lt 1 ]; then
    echo "✗ dump ichida jadval ma'lumoti yo'q" >&2
    exit 1
  fi
fi

echo "✓ tayyor: $FILE ($(du -h "$FILE" | cut -f1))"

# ── Eskilarini tozalash ─────────────────────────────────────────────────────
DELETED=$(find "$OUT_DIR" -name "qara-*.dump" -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')
[ "$DELETED" -gt 0 ] && echo "  ${RETENTION_DAYS} kundan eski ${DELETED} ta zaxira o'chirildi"

exit 0
