# Rejalashtiruvchi — dizayn (hali QURILMAGAN)

Bu hujjat `scheduled`, `delay` va `inactivity` triggerlari qanday ishlashi
kerakligini belgilaydi. **Kod hali yozilmagan** — bu reja, e'lon emas.

Hozirgi holat: `lib/automation/types.ts` da bu uchtasi `PLANNED_TRIGGERS`
ro'yxatida va UI'da tanlanmaydi (`disabled`, «Rejada» belgisi bilan).

---

## 1. Nega hozircha yo'q

Loyihada navbat ham, cron ham yo'q. Ularsiz vaqtga bog'liq triggerni
**soxta qilmasdan** qurib bo'lmaydi, shuning uchun ular ochiq «rejada»
deb belgilangan.

Redis yoki BullMQ qo'shish esa ortiqcha: bitta ilova nusxasi va bitta
Postgres uchun bazaning o'zi yetarli navbat bo'la oladi.

---

## 2. Ma'lumot modeli

Bitta yangi jadval. Mavjud `telegram_bot_automations` va
`telegram_bot_automation_runs` **o'zgarmaydi**.

```prisma
/// Kelajakda bajarilishi kerak bo'lgan avtomat.
model TelegramBotScheduledRun {
  id           String @id @default(cuid())
  automationId String
  botId        String

  /// Qachon bajarilishi kerak.
  runAt DateTime

  /// Kim band qilgani va qachon. `null` — hali erkin.
  claimedAt DateTime?
  claimedBy String?

  /// Nechta urinish bo'lgani — cheksiz qayta urinishning oldini oladi.
  attempts Int @default(0)

  /// pending | running | done | failed | cancelled
  status String @default("pending")

  /// Hodisa konteksti (foydalanuvchi, buyurtma va h.k.).
  context Json?

  /// Takrorlanmas kalit — bir hodisa ikki marta rejalashtirilmasin.
  dedupeKey String

  error      String?
  createdAt  DateTime  @default(now())
  finishedAt DateTime?

  automation TelegramBotAutomation @relation(fields: [automationId], references: [id], onDelete: Cascade)

  @@unique([automationId, dedupeKey])
  /// Worker'ning asosiy so'rovi: pending + vaqti kelgan, eng eskisidan.
  @@index([status, runAt])
  @@index([botId, createdAt])
}
```

Migratsiya **qo'shimcha** bo'ladi: bitta `CREATE TABLE` + indekslar.

---

## 3. Band qilish — poyga holatisiz

Eng muhim qism. Bir nechta worker bir vaqtda ishlasa, bitta vazifani ikki
marta bajarmasligi kerak.

Yechim — bitta atomik `UPDATE … RETURNING`:

```sql
UPDATE telegram_bot_scheduled_runs
SET    "claimedAt" = now(),
       "claimedBy" = $1,
       status      = 'running',
       attempts    = attempts + 1
WHERE  id IN (
  SELECT id FROM telegram_bot_scheduled_runs
  WHERE  status = 'pending'
    AND  "runAt" <= now()
  ORDER BY "runAt"
  LIMIT  $2
  FOR UPDATE SKIP LOCKED      -- band qatorni kutmaymiz, keyingisiga o'tamiz
)
RETURNING *;
```

`FOR UPDATE SKIP LOCKED` — Postgres'ning navbat uchun tayyor mexanizmi.
Redis kerak emas: ikkinchi worker band qatorni **kutmaydi**, shunchaki
tashlab ketadi.

Bu naqsh loyihadagi mavjud idempotentlik yondashuvi bilan bir xil
mantiqda: himoya bazada, kodda emas.

---

## 4. Worker

Alohida jarayon, `scripts/poll-bots.ts` bilan bir xil uslubda:

```
scripts/run-scheduler.ts
  har 10 soniyada:
    band qil (yuqoridagi so'rov, LIMIT 10)
    har biri uchun:
      executeAutomation(...)      ← MAVJUD dvigatel, o'zgarishsiz
      status = done | failed
    xato bo'lsa va attempts < 3:
      status = pending, runAt = now() + backoff
```

Compose'da alohida xizmat:

```yaml
scheduler:
  build: { context: ., target: runner }
  command: ["node", "scripts/run-scheduler.js"]
  depends_on:
    app: { condition: service_healthy }
  restart: unless-stopped
```

Bitta nusxa yetarli. Ko'paytirilsa ham `SKIP LOCKED` tufayli xavfsiz.

---

## 5. Uchta trigger qanday to'ldiriladi

| Trigger | Yozuv qachon yaratiladi | `runAt` |
|---|---|---|
| **`delay`** | Boshqa avtomat `wait` amalini bajarganda | `now() + kechikish` |
| **`scheduled`** | Avtomat nashr qilinganda (takrorlanuvchi) | Keyingi cron vaqti; bajarilgach keyingisi yoziladi |
| **`inactivity`** | Worker davriy skanerlaganda | `lastActiveAt + oyna` |

`inactivity` eng qimmati — u bot foydalanuvchilarini skanerlashni talab
qiladi. `telegram_bot_users` da `(botId, lastActiveAt)` indeksi allaqachon
bor, ya'ni so'rov arzon bo'ladi.

---

## 6. Nima qilinmasligi kerak

- ❌ Redis / BullMQ — bazaning o'zi yetarli
- ❌ `setInterval` ilova jarayoni ichida — bir nechta nusxada takrorlanadi
  va deploy paytida yo'qoladi
- ❌ Rejalashtirilgan ishni `broadcast` bilan aralashtirish — ular boshqa
  muammo (rate limit, segmentatsiya, opt-out) va alohida qurilishi kerak

---

## 7. Baholash

| Qism | Hajm |
|---|---|
| Migratsiya | ~40 satr |
| Band qilish + worker | ~150 satr |
| `delay` amali va UI | ~100 satr |
| Testlar | ~200 satr |

Dvigatel, idempotentlik, sikl himoyasi va bajarilish jurnali **allaqachon
bor** — rejalashtiruvchi ular ustiga qo'shiladi, ularni qayta yozmaydi.
