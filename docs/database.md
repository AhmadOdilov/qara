# Ma'lumotlar bazasi — ishlash qoidalari

Bu hujjat Qara'ning PostgreSQL qatlami bilan ishlash tartibini belgilaydi.
Har bir qoida kod bilan tasdiqlangan; taxminiy tavsiya yo'q.

**PostgreSQL 17** (`postgres:17-alpine`) · **Prisma 6.19** · 40 jadval · 40 tashqi
kalit · 116 indeks · 12 migratsiya.

---

## 1. Migratsiya

### Produksiyada faqat bitta yo'l

```bash
prisma migrate deploy
```

`docker-compose.yml` da bu alohida bir martalik `migrate` konteynerida ishlaydi
va MUVAFFAQIYATLI tugamasa `app` umuman ko'tarilmaydi
(`condition: service_completed_successfully`).

### `prisma db push` — TAQIQLANADI

`db push` migratsiya tarixini chetlab o'tib sxemani to'g'ridan-to'g'ri
o'zgartiradi. Natijada:

- baza va `prisma/migrations/` bir-biriga mos kelmay qoladi;
- keyingi `migrate deploy` kutilmagan farq topib to'xtaydi;
- qaytarish yo'li qolmaydi.

U faqat tashlab yuboriladigan mahalliy tajriba bazasida o'rinli.

### Yangi migratsiya yozish

```bash
npx prisma migrate dev --name qisqa_nom --skip-seed
cat prisma/migrations/*qisqa_nom/migration.sql   # SQL'ni O'QING
```

Yozilgan SQL'ni qo'lda ko'rib chiqish **majburiy**. Quyidagilar bo'lsa
to'xtang va qayta o'ylang:

```
DROP TABLE · DROP COLUMN · TRUNCATE · ALTER COLUMN ... NOT NULL (default'siz)
```

Ular mavjud ma'lumotni yo'q qiladi. Qo'shimcha (additive) migratsiya
xavfsiz: `CREATE TABLE`, `CREATE INDEX`, `ADD COLUMN` (default bilan).

### Migratsiyadan oldin

```bash
./scripts/backup-db.sh /srv/backups
npx prisma migrate status
```

### Holatni tekshirish

```bash
docker compose run --rm migrate npx prisma migrate status
curl -s localhost:3000/api/health/ready    # migrations: "ok" | "pending"
```

`/api/health/ready` tugallanmagan migratsiya bo'lsa **503** qaytaradi —
yarim migratsiya qilingan konteyner trafik olmaydi.

---

## 2. Tashqi kalitlar

40 ta tashqi kalit, ikki xil siyosat bilan.

### `ON DELETE CASCADE` — 37 ta

Egalik zanjiri: bola yozuv otasiz ma'nosiz.

```
workspace → bot → {buttons, users, messages, automations, payments, mini_apps, …}
bot_payment (buyurtma) → payment_transaction
automation → automation_run
button → button (parentId, ichma-ich menyu)
```

### `ON DELETE SET NULL` — 3 ta

Tarix foydalanuvchidan **omon qolishi** kerak:

| Jadval | Ustun |
|---|---|
| `analytics` | `userId` |
| `telegram_bot_audit_logs` | `actorId` |
| `api_keys` | `createdById` |

Foydalanuvchi o'chsa audit yozuvi qoladi, faqat kim qilgani noma'lum bo'ladi.

### Ma'lum cheklov: moliyaviy yozuv CASCADE ostida

`telegram_bot_payments.botId` → `telegram_bots` **CASCADE**. Bot o'chirilsa
uning buyurtmalari va ular bilan bog'liq to'lov urinishlari ham o'chadi.

Kod muallifi bu muammoni qisman tan olgan: `deleteBot()` audit yozuvini
ATAYLAB `botId` siz yozadi, aks holda «bot o'chirildi» yozuvining o'zi ham
cascade bilan ketardi (`lib/bots/service.ts`).

#### Uchta variant tahlil qilindi

| Variant | Nima bo'ladi | Baho |
|---|---|---|
| **`RESTRICT`** | Buyurtmasi bor botni o'chirib bo'lmaydi | 🔴 Foydalanuvchi tuzoqqa tushadi: sinov uchun yaratgan botini ham o'chirolmaydi. Oldin buyurtmalarni qo'lda tozalash kerak bo'ladi — bu ham xuddi shu ma'lumotni yo'q qiladi, faqat ko'proq qadam bilan |
| **`SET NULL`** | Buyurtma qoladi, boti noma'lum | 🔴 `botId` hozir `NOT NULL`. Uni nullable qilish MAVJUD ma'lumot ustida sxema o'zgarishi va butun kod bo'ylab `botId` tekshiruvlarini qayta ko'rib chiqishni talab qiladi. Ish maydoni izolyatsiyasi `botId` ga tayanadi — u yo'qolsa buyurtma egasi ham noma'lum bo'ladi |
| **Yumshoq o'chirish** | Bot `deletedAt` bilan belgilanadi | 🟡 Eng to'g'ri yechim, lekin eng qimmat: har bir so'rovga `deletedAt IS NULL` qo'shish, unikal cheklovlarni qayta ko'rib chiqish (`telegramBotId` `@unique` — o'chirilgan bot tokenni band qilib turadi), UI va analitikani moslash |

#### Qaror: hozircha o'zgartirilmaydi

Sabab:

1. **Bugun xavf ostidagi ma'lumot yo'q** — bazada 0 ta buyurtma, 0 ta to'lov
   urinishi. To'lov provayderlari hali ulanmagan, ya'ni haqiqiy pul o'tmagan.
2. Uch variantning ikkitasi **holatni yomonlashtiradi**, uchinchisi esa
   ishlayotgan featurelarni qayta yozishni talab qiladi.
3. Destruktiv migratsiyani asossiz qilish taqiqlangan.

#### Qachon qayta ko'rib chiqish kerak

Payme/Click ulangan va **birinchi haqiqiy to'lov o'tgan** zahoti. O'shanda
yumshoq o'chirish yagona to'g'ri variant bo'ladi.

#### Hozirgi himoya

- Kunlik zaxira (`scripts/backup-db.sh`) — bot tasodifan o'chirilsa
  buyurtmalar zaxiradan tiklanadi;
- bot o'chirish `bot:delete` huquqini talab qiladi (faqat `owner`/`admin`);
- UI'da tasdiqlash oynasi bor.

**Tavsiya:** to'lovlar ishga tushgach, bot o'chirish oynasiga «bu botda N ta
to'langan buyurtma bor» ogohlantirishini qo'shing — bu sxemaga tegmaydigan
eng arzon himoya.

---

## 3. Tranzaksiyalar

### Qoida: tranzaksiya ichida TASHQI chaqiruv bo'lmaydi

Tranzaksiya ichida `fetch()`, Telegram API yoki avtomat dispatch chaqirilsa:

- sekin tashqi so'rov baza qulfini ushlab turadi;
- tashqi xato butun tranzaksiyani qaytarib yuboradi.

Tekshirildi: hozirgi 5 ta `$transaction` blokining birortasida ham tashqi
chaqiruv yo'q.

### To'lov — namunaviy holat

```
BEGIN
  provayder tranzaksiyasini band qilish  (unique constraint)
  holat mashinasini tekshirish
  to'lov holatini yozish
  buyurtma holatini yozish
COMMIT
  ↓
avtomat dispatch  ← TASHQARIDA
```

Avtomat ataylab tranzaksiyadan tashqarida: u xabar yuboradi va webhook
chaqiradi. Uning xatosi to'lovni **qaytarib yubormasligi** kerak — pul
allaqachon o'tgan.

### Idempotentlik — baza darajasida

«Avval o'qib, keyin yozish» ishlatilmaydi: ikkita nusxa bir vaqtda kelsa
poyga hosil bo'lardi. O'rniga to'g'ridan-to'g'ri `INSERT` va unikal
cheklovga tayanish (`P2002` kutilgan holat):

| Kafolat | Cheklov |
|---|---|
| Bitta to'lov ikki marta o'tmaydi | `(provider, providerTransactionId)` |
| Bitta hodisa avtomatni ikki marta ishga tushirmaydi | `(automationId, dedupeKey)` |
| Telegram update ikki marta qayta ishlanmaydi | `(botId, updateId)` |
| Bir odam ikki marta a'zo bo'lmaydi | `(workspaceId, userId)` |
| Bot foydalanuvchisi takrorlanmaydi | `(botId, telegramUserId)` |

---

## 4. Indekslash siyosati

**Indeks faqat HAQIQIY so'rov talab qilganda qo'shiladi.** «Kerak bo'lib
qolar» degan indeks yozishga ruxsat yo'q: har bir indeks yozish amalini
sekinlashtiradi va joy egallaydi.

Yangi indeks qo'shishdan oldin:

1. so'rovni kodda ko'rsating (`where` + `orderBy` bilan);
2. mavjud indekslardan birortasi uni qoplamasligini tekshiring;
3. `EXPLAIN` bilan foydani ko'rsating.

Misol — oxirgi qo'shilgan indeks:

```
so'rov:  runs WHERE automationId = ? ORDER BY startedAt DESC LIMIT 25
mavjud:  (botId, startedAt), (automationId, status)   ← ikkalasi ham qoplamaydi
qo'shildi: (automationId, startedAt)
```

`pg_stat_user_indexes.idx_scan = 0` bo'yicha indeks **o'chirilmaydi**:
dev bazasida statistika ma'nosiz, produksiyada esa kamdan-kam ishlatiladigan
indeks ham kerakli bo'lishi mumkin.

---

## 5. Sahifalash

Ro'yxat qaytaradigan har bir so'rovda chegara bo'lishi **shart**.

`lib/pagination.ts` — yagona manba:

```
standart 50 · maksimum 100 · buzuq parametr standartga tushadi
```

Klient yuborgan `?size=99999` bazaga yetib bormaydi. Qidiruv ham server
tomonda: klient faqat yuklangan qatorlarni filtrlasa, ro'yxatdan tashqaridagi
yozuv topilmay qolardi.

---

## 6. Ulanishlar hovuzi (connection pool)

`DATABASE_URL` da `connection_limit` **belgilanmagan** — Prisma standarti
ishlaydi: `jadval_yadro_soni × 2 + 1`.

### Bitta nusxa uchun

Standart qiymat yetarli. PostgreSQL'ning `max_connections` standarti 100,
bitta ilova nusxasi undan ancha kam oladi.

### Bir nechta nusxa uchun

Nusxalar soni × hovuz hajmi `max_connections` dan **oshmasligi** kerak.
Hisob:

```
connection_limit = (max_connections − 10) / nusxalar_soni
```

(10 ta ulanish administrator va migratsiya uchun zaxira qoldiriladi.)

Belgilash:

```
DATABASE_URL="postgresql://…/qara?schema=public&connection_limit=15&pool_timeout=20"
```

Hardcode qilinmaydi — faqat `.env` orqali.

---

## 7. Zaxira va tiklash

```bash
./scripts/backup-db.sh /srv/backups                    # custom format, siqilgan
./scripts/restore-db.sh /srv/backups/qara-….dump       # tasdiq so'raydi
```

Skript zaxirani **tekshiradi** (`pg_restore --list` bilan jadval ma'lumoti
borligini) va faqat shundan keyin eskilarini o'chiradi — buzuq zaxira
yaxshisini almashtirib qo'ymaydi.

### Sirlar zaxirada YO'Q

Bot tokenlari va API kalitlari bazaga **AES-256-GCM bilan shifrlangan**
holda yoziladi. Ya'ni dump o'z-o'zicha foydasiz — ochish uchun `SECRETS_KEY`
kerak.

**Shuning uchun `SECRETS_KEY` ni zaxiradan ALOHIDA joyda saqlang.** Kalit
yo'qolsa tiklangan bazadagi tokenlar ochilmaydi va ularni qaytadan kiritish
kerak bo'ladi.

### Cron

```cron
0 3 * * * cd /srv/qara && ./scripts/backup-db.sh /srv/backups >> /var/log/qara-backup.log 2>&1
```

`BACKUP_RETENTION_DAYS` (standart 14) dan eskilari o'chiriladi.

---

## 8. Produksiyadagi xavfsizlik

| Chora | Holati |
|---|---|
| Postgres porti | Prod overlay bilan tashqariga **umuman ochilmaydi** |
| Parol | `.env` orqali, image ichida yo'q |
| Bot tokenlari | AES-256-GCM, UI'da faqat maska |
| API kalitlari | SHA-256 xesh, ochiq matn saqlanmaydi |
| Ish maydoni izolyatsiyasi | Har so'rovda `workspaceId` bo'yicha tekshiruv |
| Loglar | `redactSecrets()` + `lib/log.ts` dagi taqiqlangan maydonlar |

### Qo'lda SQL yozish

Produksiya bazasida qo'lda `UPDATE`/`DELETE` yozishdan oldin:

1. zaxira oling;
2. avval `SELECT` bilan nechta qator tegishini ko'ring;
3. `BEGIN` … tekshiring … `COMMIT` (yoki `ROLLBACK`).
