#!/usr/bin/env bash
#
# Qara — zaxiradan tiklash (§P5 PHASE 6).
#
#   ./scripts/restore-db.sh backups/qara-20260820-120000.dump
#
# DIQQAT: tiklash MAVJUD ma'lumot ustiga yozadi. Shuning uchun tasdiq
# so'raladi va `--clean` faqat ochiq aytilganda ishlatiladi.
#
# Tiklashdan keyin `SECRETS_KEY` O'SHA qiymatda bo'lishi shart — aks holda
# bot tokenlari va API kalitlari ochilmaydi (ular AES-256-GCM bilan
# shifrlangan).

set -euo pipefail

FILE="${1:?Foydalanish: ./scripts/restore-db.sh <dump-fayli> [--clean]}"
CLEAN="${2:-}"

DB_USER="${POSTGRES_USER:-qara}"
DB_NAME="${POSTGRES_DB:-qara}"
CONTAINER="${POSTGRES_CONTAINER:-qara-postgres}"

[ -f "$FILE" ] || { echo "✗ fayl topilmadi: $FILE" >&2; exit 1; }

echo "→ tiklash: $FILE → $DB_NAME"
echo "  DIQQAT: mavjud ma'lumot ustiga yoziladi."
read -r -p "  Davom etilsinmi? (ha/yo'q) " ANSWER
case "$ANSWER" in
  ha|HA|yes|y) ;;
  *) echo "bekor qilindi"; exit 0 ;;
esac

ARGS=(--no-owner --no-privileges -d "$DB_NAME" -U "$DB_USER")
[ "$CLEAN" = "--clean" ] && ARGS+=(--clean --if-exists)

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  # Fayl nomi BERILMAYDI — pg_restore stdin'ni o'qiydi. Konteyner ichida
  # `/dev/stdin` ishlamaydi.
  docker exec -i "$CONTAINER" pg_restore "${ARGS[@]}" < "$FILE"
else
  : "${DATABASE_URL:?DATABASE_URL kerak}"
  # Prisma `?schema=public` qo'shadi, `pg_restore` esa uni tushunmaydi.
  pg_restore --no-owner --no-privileges ${CLEAN:+--clean --if-exists} -d "${DATABASE_URL%%\?*}" "$FILE"
fi

echo "✓ tiklandi"
echo ""
echo "Keyingi qadam — migratsiya holatini tekshiring:"
echo "  npx prisma migrate status"
echo "  curl -s localhost:3000/api/health/ready"
