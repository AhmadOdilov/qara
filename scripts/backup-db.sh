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

# ── Diskdan tashqariga nusxa (§P12 PHASE 6) ─────────────────────────────────
# Zaxira Postgres bilan BIR DISKDA tursa, u zaxira emas: disk ishdan chiqsa
# yoki server o'chirilsa ikkalasi birga ketadi. `BACKUP_MIRROR_DIR` — ikkinchi
# manzil: boshqa disk, NFS/SMB ulanish nuqtasi yoki obyekt xotirasi mount'i.
#
#   BACKUP_MIRROR_DIR=/mnt/backup-nas ./scripts/backup-db.sh
#
# Nusxa MUVAFFAQIYATSIZ bo'lsa skript xato bilan tugaydi — cron jimgina
# "hammasi joyida" deb o'ylamasin. Aynan shu jimlik zaxirani foydasiz qiladi:
# nosozlik kuni ma'lum bo'ladiki, oylar davomida nusxa ko'chmagan ekan.
MIRROR_DIR="${BACKUP_MIRROR_DIR:-}"
if [ -n "$MIRROR_DIR" ]; then
  echo "→ nusxa: $MIRROR_DIR"

  if ! mkdir -p "$MIRROR_DIR" 2>/dev/null; then
    echo "✗ nusxa papkasini yaratib bo'lmadi: $MIRROR_DIR" >&2
    echo "  (ulanish nuqtasi o'rnatilganmi? yozish huquqi bormi?)" >&2
    exit 1
  fi

  # Avval vaqtinchalik nomga yozamiz: yarim ko'chgan fayl tugallangan
  # zaxiraga o'xshab qolmasin.
  MIRROR_TMP="${MIRROR_DIR}/.$(basename "$FILE").part"
  MIRROR_FILE="${MIRROR_DIR}/$(basename "$FILE")"

  if ! cp "$FILE" "$MIRROR_TMP" 2>/dev/null; then
    echo "✗ nusxa ko'chirilmadi: $MIRROR_DIR" >&2
    rm -f "$MIRROR_TMP"
    exit 1
  fi

  # Hajmini solishtiramiz — to'lgan disk `cp` ni jimgina qisqartirishi mumkin.
  SRC_SIZE=$(wc -c < "$FILE" | tr -d ' ')
  DST_SIZE=$(wc -c < "$MIRROR_TMP" | tr -d ' ')
  if [ "$SRC_SIZE" != "$DST_SIZE" ]; then
    echo "✗ nusxa to'liq emas: $DST_SIZE / $SRC_SIZE bayt (disk to'lganmi?)" >&2
    rm -f "$MIRROR_TMP"
    exit 1
  fi

  mv "$MIRROR_TMP" "$MIRROR_FILE"
  echo "  ✓ nusxa tayyor: $MIRROR_FILE"

  # Nusxa papkasida ham retention qo'llanadi.
  MIRROR_DELETED=$(find "$MIRROR_DIR" -name "qara-*.dump" -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')
  [ "$MIRROR_DELETED" -gt 0 ] && echo "  nusxadan ${MIRROR_DELETED} ta eski fayl o'chirildi"
else
  echo "  ⚠ BACKUP_MIRROR_DIR sozlanmagan — zaxira baza bilan BIR DISKDA."
  echo "    Diskdan tashqariga nusxa qo'ying, aks holda disk nosozligida"
  echo "    baza ham, zaxira ham birga yo'qoladi."
fi

# ── Eskilarini tozalash ─────────────────────────────────────────────────────
DELETED=$(find "$OUT_DIR" -name "qara-*.dump" -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')
[ "$DELETED" -gt 0 ] && echo "  ${RETENTION_DAYS} kundan eski ${DELETED} ta zaxira o'chirildi"

exit 0
