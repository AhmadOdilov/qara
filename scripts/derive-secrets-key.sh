#!/usr/bin/env bash
#
# Qara — mavjud SECRETS_KEY ni hisoblab beradi (§P12 PHASE 1).
#
#   ./scripts/derive-secrets-key.sh
#
# NEGA KERAK.
#
# Ilova ilgari `SECRETS_KEY` siz ishlagan bo'lsa, `lib/crypto.ts` shifrlash
# kalitini AUTH_SECRET'dan hosil qilardi:
#
#     sha256("qara-secrets:" + AUTH_SECRET)
#
# Endi `SECRETS_KEY` produksiyada MAJBURIY. Agar unga YANGI tasodifiy qiymat
# qo'yilsa, bazadagi mavjud bot tokenlari va API kalitlari boshqa kalit bilan
# shifrlangani uchun OCHILMAY qoladi — qaytarib bo'lmaydi.
#
# Bu skript o'sha amaldagi kalitni chop etadi. Uni `.env` ga ko'chirsangiz
# shifrlash kaliti O'ZGARMAYDI va hamma eski qiymat o'qilaveradi.
#
# TOZA o'rnatishda (bazada shifrlangan sir yo'q) bu skript kerak emas —
# shunchaki yangi kalit yarating:
#
#     openssl rand -base64 32
#
# DIQQAT: chiqarilgan qiymat — SIR. Uni loglarga, chat'ga yoki git'ga
# tushirmang. Zaxira nusxadan ALOHIDA joyda saqlang: kalitsiz dump foydasiz,
# lekin kalit dump bilan bir joyda tursa ikkalasi ham bir vaqtda o'g'irlanadi.

set -euo pipefail

ENV_FILE="${1:-.env}"

# AUTH_SECRET ni muhitdan yoki .env dan olamiz. Fayl o'qilganda faqat SHU
# o'zgaruvchi ajratib olinadi — butun fayl `source` qilinmaydi, chunki unda
# ixtiyoriy buyruq bo'lishi mumkin.
if [ -z "${AUTH_SECRET:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    AUTH_SECRET="$(
      grep -E '^[[:space:]]*AUTH_SECRET=' "$ENV_FILE" \
        | tail -1 \
        | sed -E 's/^[[:space:]]*AUTH_SECRET=//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
    )"
  fi
fi

if [ -z "${AUTH_SECRET:-}" ]; then
  echo "✗ AUTH_SECRET topilmadi." >&2
  echo "  Muhitda bering yoki $ENV_FILE ichida belgilang:" >&2
  echo "    AUTH_SECRET=\"…\" ./scripts/derive-secrets-key.sh" >&2
  exit 1
fi

command -v openssl >/dev/null 2>&1 || {
  echo "✗ openssl topilmadi — u kalitni hisoblash uchun kerak." >&2
  exit 1
}

# `lib/crypto.ts` dagi hosila bilan AYNAN bir xil bo'lishi shart:
#   createHash("sha256").update(`qara-secrets:${AUTH_SECRET}`).digest()
# 32 bayt chiqadi, base64 ko'rinishida yoziladi va `key()` uni to'g'ridan-
# to'g'ri ishlatadi (decoded.length === 32 sharti bajariladi).
DERIVED="$(printf 'qara-secrets:%s' "$AUTH_SECRET" | openssl dgst -sha256 -binary | base64)"

echo "Amaldagi shifrlash kaliti (AUTH_SECRET'dan hosil qilingan):"
echo
echo "SECRETS_KEY=\"${DERIVED}\""
echo
echo "Buni .env ga qo'shing — shifrlash kaliti o'zgarmaydi va bazadagi"
echo "mavjud bot tokenlari o'qilaveradi."
echo
echo "DIQQAT: bu qiymat SIR. Loglarga yoki git'ga tushirmang."
