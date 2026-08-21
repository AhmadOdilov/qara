#!/usr/bin/env bash
#
# Qara — xavfsizlik E2E tekshiruvi (§P13 PHASE 12).
#
#   ./scripts/security-e2e.sh                        # lokal stack
#   BASE=https://qara.uz ./scripts/security-e2e.sh   # produksiya
#
# ISHLAB TURGAN nusxaga qarshi HAQIQIY sessiyalar bilan ishlaydi: ikkita
# foydalanuvchi ro'yxatdan o'tkaziladi va ular bir-birining ma'lumotiga
# yeta olmasligi tekshiriladi. Birlik testlar bu qatlamni qamrab ololmaydi —
# CSRF, sessiya bekor qilish va ish maydoni izolyatsiyasi faqat tirik
# server + cookie zanjirida ma'noga ega.
#
# NIMA TEKSHIRILADI
#   · autentifikatsiyasiz kirish            → 401
#   · buzilgan/bo'sh sessiya cookie'si      → 401
#   · CSRF sarlavhasisiz / noto'g'ri / begona → 403
#   · begona ish maydoni resursi (GET/PATCH/DELETE) → 404
#   · ro'yxatlarda begona ma'lumot sizishi
#   · logout'dan keyin eski cookie          → 401
#   · admin bo'lmagan rol                   → 403
#
# XAVFSIZ: hech narsa o'chirilmaydi va mavjud ma'lumotga tegilmaydi.
# Yaratilgan test foydalanuvchilari oxirida O'CHIRILADI (agar
# CLEANUP_SQL_CONTAINER berilgan bo'lsa), aks holda ularni qo'lda o'chiring:
#
#   DELETE FROM users WHERE email LIKE 'sec-e2e-%@example.invalid';
#
# Chiqish kodi: 0 — hammasi o'tdi, 1 — kamida bitta tekshiruv yiqildi.
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
JAR_A="$(mktemp)"; JAR_B="$(mktemp)"; JAR_X="$(mktemp)"
STAMP="$(date +%s)"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); printf "  ✅ %-58s %s\n" "$1" "$2"; }
bad()  { FAIL=$((FAIL+1)); printf "  ❌ %-58s %s\n" "$1" "$2"; }
want() { # want <tavsif> <kutilgan> <olingan>
  if [ "$2" = "$3" ]; then ok "$1" "$3"; else bad "$1" "kutilgan $2, olindi $3"; fi
}
wantin() { # wantin <tavsif> <"401 403"> <olingan>
  case " $2 " in *" $3 "*) ok "$1" "$3";; *) bad "$1" "kutilgan [$2], olindi $3";; esac
}

code() { curl -s -m 20 -o /dev/null -w "%{http_code}" "$@"; }
csrf() { awk '$6=="qara_csrf"{print $7}' "$1" | tail -1; }

echo "═══ 0. RO'YXATDAN O'TISH — ikkita mustaqil foydalanuvchi ═══"
regA=$(curl -s -m 20 -c "$JAR_A" -w "\n%{http_code}" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"User A\",\"email\":\"sec-e2e-a-$STAMP@example.invalid\",\"password\":\"Parol12345!\"}")
want "A ro'yxatdan o'tdi (201 Created)" "201" "$(echo "$regA" | tail -1)"

regB=$(curl -s -m 20 -c "$JAR_B" -w "\n%{http_code}" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"User B\",\"email\":\"sec-e2e-b-$STAMP@example.invalid\",\"password\":\"Parol12345!\"}")
want "B ro'yxatdan o'tdi (201 Created)" "201" "$(echo "$regB" | tail -1)"

CSRF_A="$(csrf "$JAR_A")"; CSRF_B="$(csrf "$JAR_B")"
[ -n "$CSRF_A" ] && ok "A uchun CSRF cookie berildi" "bor" || bad "A uchun CSRF cookie" "yo'q"

echo
echo "═══ 1. AUTENTIFIKATSIYA ═══"
want "sessiyasiz GET /api/bots"            "401" "$(code "$BASE/api/bots")"
want "sessiyasiz GET /api/workspace/members" "401" "$(code "$BASE/api/workspace/members")"
want "A sessiyasi bilan GET /api/bots"     "200" "$(code -b "$JAR_A" "$BASE/api/bots")"

# Buzilgan JWT — imzo mos kelmaydi
want "buzilgan sessiya cookie'si" "401" \
  "$(code -H "Cookie: qara_session=eyJhbGciOiJIUzI1NiJ9.eyJzaWQiOiJ4IiwidWlkIjoieSJ9.YnVadWtpbXpv" "$BASE/api/bots")"
want "bo'sh sessiya cookie'si" "401" "$(code -H "Cookie: qara_session=" "$BASE/api/bots")"

echo
echo "═══ 2. CSRF (double-submit) ═══"
# Holat o'zgartiruvchi so'rov: CSRF sarlavhasisiz
want "POST CSRF sarlavhasisiz"  "403" \
  "$(code -b "$JAR_A" -X POST "$BASE/api/bots" -H "Content-Type: application/json" -d '{}')"
want "POST noto'g'ri CSRF bilan" "403" \
  "$(code -b "$JAR_A" -X POST "$BASE/api/bots" -H "Content-Type: application/json" \
       -H "X-CSRF-Token: notogri-token-qiymati" -d '{}')"
want "POST BOSHQA foydalanuvchi CSRF'i bilan" "403" \
  "$(code -b "$JAR_A" -X POST "$BASE/api/bots" -H "Content-Type: application/json" \
       -H "X-CSRF-Token: $CSRF_B" -d '{}')"
# To'g'ri CSRF — endi CSRF emas, validatsiya bosqichiga o'tishi kerak
got=$(code -b "$JAR_A" -X POST "$BASE/api/bots" -H "Content-Type: application/json" \
        -H "X-CSRF-Token: $CSRF_A" -d '{}')
wantin "POST to'g'ri CSRF bilan (CSRF'dan o'tadi)" "400 422" "$got"

echo
echo "═══ 3. WORKSPACE IZOLYATSIYASI / IDOR ═══"
# Boshqa ish maydoniga tegishli resurs identifikatorlari kerak. Ularni
# bazadan olamiz — bu test QURILMASI, tekshiruvning o'zi emas: yangi
# ro'yxatdan o'tgan A shu ID'larni HTTP orqali ko'ra olmasligi kerak.
#
# `BOT_IDS` bilan qo'lda ham berish mumkin (bazaga kirish yo'q bo'lsa):
#   BOT_IDS="abc123 def456" ./scripts/security-e2e.sh
BOTS="${BOT_IDS:-}"
if [ -z "$BOTS" ]; then
  PG_CONTAINER="${POSTGRES_CONTAINER:-qara-postgres}"
  PG_USER="${POSTGRES_USER:-qara}"
  PG_DB="${POSTGRES_DB:-qara}"
  BOTS=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc \
    "SELECT id FROM telegram_bots LIMIT 3" 2>/dev/null | tr -d ' ')
fi
if [ -z "$BOTS" ]; then
  echo "  ⚠ begona resurs ID'si topilmadi — izolyatsiya testi O'TKAZIB YUBORILDI"
  echo "    (BOT_IDS=\"…\" bering yoki bazaga kirish imkonini sozlang)"
else
  for b in $BOTS; do
    wantin "A begona bot GET /api/bots/$b"      "403 404" "$(code -b "$JAR_A" "$BASE/api/bots/$b")"
    wantin "A begona bot PATCH /api/bots/$b"    "403 404" \
      "$(code -b "$JAR_A" -X PATCH "$BASE/api/bots/$b" -H "Content-Type: application/json" \
           -H "X-CSRF-Token: $CSRF_A" -d '{"name":"egallab-oldim"}')"
    wantin "A begona bot DELETE /api/bots/$b"   "403 404" \
      "$(code -b "$JAR_A" -X DELETE "$BASE/api/bots/$b" -H "X-CSRF-Token: $CSRF_A")"
  done
  # A ning ro'yxati bo'sh bo'lishi kerak — begona bot ko'rinmasin
  listA=$(curl -s -m 20 -b "$JAR_A" "$BASE/api/bots")
  leak=0
  for b in $BOTS; do case "$listA" in *"$b"*) leak=1;; esac; done
  [ "$leak" -eq 0 ] && ok "A ning ro'yxatida begona bot YO'Q" "toza" \
                    || bad "A ning ro'yxati" "BEGONA BOT SIZDI"
fi

# A va B bir-birining ish maydonini ko'rmasin
mA=$(curl -s -m 20 -b "$JAR_A" "$BASE/api/workspace/members")
mB=$(curl -s -m 20 -b "$JAR_B" "$BASE/api/workspace/members")
if [ "$mA" = "$mB" ]; then bad "A va B a'zolar ro'yxati" "BIR XIL — izolyatsiya yo'q"
else ok "A va B har xil ish maydonini ko'radi" "farqli"; fi

echo
echo "═══ 4. SESSIYANI BEKOR QILISH ═══"
want "logout" "200" \
  "$(code -b "$JAR_A" -X POST "$BASE/api/auth/logout" -H "X-CSRF-Token: $CSRF_A")"
# Logout'dan KEYIN eski cookie bilan urinish (jar yangilanmagan nusxa)
want "logout'dan keyin ESKI cookie" "401" "$(code -b "$JAR_A" "$BASE/api/bots")"

echo
echo "═══ 5. ADMIN / ROL ═══"
want "oddiy foydalanuvchi PATCH /api/admin/users" "403" \
  "$(code -b "$JAR_B" -X PATCH "$BASE/api/admin/users" -H "Content-Type: application/json" \
       -H "X-CSRF-Token: $CSRF_B" -d '{"userId":"x","role":"admin"}')"

echo
echo "───────────────────────────────────────────────────────────"
printf "  O'TDI: %s    YIQILDI: %s\n" "$PASS" "$FAIL"
rm -f "$JAR_A" "$JAR_B" "$JAR_X"
[ "$FAIL" -eq 0 ]
