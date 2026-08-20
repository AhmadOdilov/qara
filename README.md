# Qara

Veb-ilova va Telegram bot integratsiyasi: veb-sahifadan to'g'ridan-to'g'ri
Telegram botga xabar yuborish, botdan kelgan javoblarni o'sha oynada olish.
Google OAuth va email/parol bilan kirish, profil, admin paneli, analitika,
bildirishnomalar va uch tilli interfeys (uz / ru / en).

Loyiha *«Qara startapi loyihasi (ijrochi xulosa)»* hujjatidagi talablar asosida
qurilgan.

---

## Tez boshlash

Talablar: **Node.js 20+**, **PostgreSQL 14+** (yoki Docker).

```bash
# 1. Bog'liqliklar
npm install

# 2. Muhit o'zgaruvchilari
cp .env.example .env
# .env ichida AUTH_SECRET ni almashtiring:
#   openssl rand -base64 32

# 3. Ma'lumotlar bazasi
#    3a) Lokal Postgres bilan:
psql -U postgres -c "CREATE ROLE qara LOGIN PASSWORD 'qara' CREATEDB"
psql -U postgres -c "CREATE DATABASE qara OWNER qara"
#    3b) yoki Docker bilan (DATABASE_URL portini 5433 ga o'zgartiring):
# docker compose up -d

# 4. Sxema va demo ma'lumot
npm run db:migrate
npm run db:seed

# 5. Ishga tushirish
npm run dev
```

`http://localhost:3000` ni oching.

**Demo hisoblar** (`npm run db:seed` dan keyin):

| Rol   | Email                 | Parol      |
|-------|-----------------------|------------|
| admin | `admin@qara.uz`       | `qara1234` |
| user  | `dilnoza@example.com` | `qara1234` |

---

## MOCK rejim — bot tokenisiz sinash

`TELEGRAM_BOT_TOKEN` bo'sh bo'lsa ilova **MOCK rejimda** ishlaydi:

- Telegram API'ga hech qanday so'rov yuborilmaydi;
- «Telegram bog'lash» o'rniga **«Mock bog'lanishni yaratish»** tugmasi chiqadi
  va hisob soxta `chat_id` bilan bog'lanadi;
- chat ostida **«Telegramdan javobni simulyatsiya qilish»** qatori paydo
  bo'ladi — u kiritilgan matnni haqiqiy webhook o'tadigan **aynan o'sha**
  `handleUpdate()` yo'lidan o'tkazadi.

Ya'ni butun oqim (bog'lash → yuborish → javob olish) tokensiz ham to'liq
sinaladi va real token qo'yilganda xatti-harakat o'zgarmaydi.

---

## Haqiqiy Telegram botni ulash

### 1. Bot yaratish

1. Telegramda [@BotFather](https://t.me/BotFather) ni oching → `/newbot`.
2. Bot nomi va `_bot` bilan tugaydigan username kiriting.
3. Berilgan tokenni `.env` ga qo'ying:

```env
TELEGRAM_BOT_TOKEN="123456:AA..."
TELEGRAM_BOT_USERNAME="sizning_bot"
TELEGRAM_WEBHOOK_SECRET="<openssl rand -hex 16>"
```

### 2. Webhook

Webhook HTTPS talab qiladi. Lokal sinov uchun tunnel oching:

```bash
npx localtunnel --port 3000     # yoki: ngrok http 3000
```

Berilgan HTTPS manzilni `.env` dagi `APP_URL` ga yozing, serverni qayta
ishga tushiring va **Admin → Bot sozlamalari → `setWebhook`** tugmasini bosing.

Qo'lda ham qilish mumkin:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<APP_URL>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Har bir kiruvchi so'rov `X-Telegram-Bot-Api-Secret-Token` sarlavhasi bo'yicha
tekshiriladi — mos kelmasa 401 qaytadi.

### 3. Bot buyruqlari

| Buyruq      | Vazifasi                                     |
|-------------|----------------------------------------------|
| `/start <token>` | Deep link orqali hisobni bog'lash       |
| `/help`     | Yordam                                        |
| `/settings` | Joriy til va tinch rejim holati              |
| `/unlink`   | Bog'lanishni uzish                           |

Oddiy matn foydalanuvchining veb-chatiga tushadi. Bot javob tilini Telegram
update'idagi `language_code` bo'yicha tanlaydi.

**Bitta botda ikki oqim.** Chat hisobga bog'langan bo'lsa yuqoridagi jadval
ishlaydi. Bog'lanmagan chat esa **onboarding botiga** tushadi — biznes
yaratish suhbati (`/create`, `?start=onboarding|bot|store|demo`). Bog'lash
undan ustun turadi: `/start <token>` dagi payload haqiqiy bog'lash tokeni
bo'lsa hisob bog'lanadi, aks holda chat onboardingga o'tadi. Shu tartib
tufayli veb-ilovadagi «Telegramni bog'lash» havolasi ham, marketing deep
link'lari ham bir vaqtda ishlaydi (`lib/bot-handler.ts`).

---

## Google OAuth (Gmail bilan kirish)

1. [Google Cloud Console](https://console.cloud.google.com) → *APIs & Services*
   → *Credentials* → **Create OAuth client ID** → *Web application*.
2. **Authorized redirect URI**: `{APP_URL}/api/auth/google/callback`
3. Client ID va Secret'ni `.env` ga qo'ying:

```env
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
```

Bo'sh qoldirilsa — Google tugmasi ko'rsatilmaydi, email/parol bilan kirish
ishlayveradi. Kirish `id_token` ni Google JWKS orqali tekshirish bilan
yakunlanadi (imzo, issuer, audience, muddat). Bir xil emailli mavjud hisob
topilsa, yangi hisob yaratilmay, `googleId` o'sha hisobga qo'shiladi.

---

## Bot konstruktori — «Botlarim»

Yuqoridagi bo'limlar Qara'ning **o'z** boti haqida edi. `/bots` bo'limi esa
boshqa narsa: har bir foydalanuvchi **o'zining** Telegram botlarini ulaydi va
shu yerdan boshqaradi.

### Bot ulash

1. `Botlarim` → **Bot ulash**.
2. @BotFather bergan tokenni qo'ying.
3. Token darhol `getMe` orqali tekshiriladi, so'ng **AES-256-GCM** bilan
   shifrlanib `telegram_bot_secrets` jadvaliga yoziladi.
4. `APP_URL` HTTPS bo'lsa webhook o'sha zahoti o'rnatiladi va bot ishlay
   boshlaydi. Aks holda bot `Sozlash kerak` holatida qoladi.

Har bir botning **o'z webhook secret'i** bor va manzili
`{APP_URL}/api/telegram/bots/<botId>`. Kiruvchi so'rov shu bot uchun
saqlangan secret bilan solishtiriladi (`timingSafeEqual`), ya'ni bitta
botning manzilini bilgan odam boshqasiga update yubora olmaydi.

### Lokal ishlab chiqish — polling rejimi

Telegram webhook'ni faqat HTTPS manzilga yuboradi, `http://localhost` esa unga
to'g'ri kelmaydi. Tunnel ochib o'tirmaslik uchun **polling** rejimi bor —
update'larni Telegram'dan o'zimiz so'rab olamiz:

```bash
npm run bot:poll
```

```
[poll] polling rejimi ishga tushdi — to'xtatish uchun Ctrl+C
[poll] kuzatilmoqda: @mening_botim (Mening botim)
[poll] /start  ← Akhmadbek (id 17179…)
[poll]   → «Assalomu alaykum! Men — Mening botim…»
```

Skript ishlab turganda bot Telegramda **haqiqatan javob beradi** — hech narsa
internetga ochilmaydi va `APP_URL` o'zgarmaydi. Update'lar aynan webhook
o'tadigan `handleBotUpdate()` yo'lidan o'tadi, ya'ni prodga chiqqanda
xatti-harakat o'zgarmaydi.

Bilib qo'yish kerak:

- **Polling va webhook birga ishlamaydi.** Skript ishga tushganda har bir
  botning webhook'i olib tashlanadi (Telegram aks holda 409 qaytaradi).
  Prodga qaytishda bot sahifasidan **«O'rnatish»** ni bosing.
- Skript ishlaganda bot holati `Ishlayapti` ga o'tadi, `Ctrl+C` bilan
  to'xtatilganda `Sozlash kerak` ga qaytadi.
- Yangi ulangan botlar 15 soniya ichida o'zi kuzatuvga tushadi — skriptni
  qayta ishga tushirish shart emas.

### Sinov oynasi — Telegramsiz

Bot sahifasidagi **«Sinov»** bo'limi umuman Telegramga chiqmaydi: xabar o'sha
`handleBotUpdate()` yo'lidan o'tadi, javob esa yuborilmay o'sha oynada
ko'rsatiladi. Buyruqlar, tugmalar va menyular mantig'ini tez tekshirish uchun
qulay — bot tokeni haqiqiy bo'lishi ham shart emas.

### Buyruqlar

Bot sahifasidagi **«Buyruqlar»** jadvali `setMyCommands` orqali Telegram
menyusiga yoziladi. Buyruq nomi normallashtiriladi (`/START` → `start`) va
Telegram cheklovlariga (1–32 belgi, `a-z0-9_`) mosligi tekshiriladi.

### Tugmalar va menyular — vizual konstruktor

Bot sahifasidagi **«Tugmalar»** bo'limi ichma-ich menyu daraxtini yig'adi:
chapda daraxt, o'ngda tanlangan tugma sozlamalari, yonida jonli Telegram
preview. Kod yozilmaydi — `Bosh menyu → Kategoriya → Mahsulot → Savat →
Buyurtma` oqimi to'lig'icha shu yerdan quriladi.

**Daraxt va sudrab ko'chirish.** Ildizdan mahsulot kartasigacha hammasi bitta
ro'yxatda, chuqurlik cheklanmagan. Sudrashda uch zona farqlanadi: qatorning
ustiga (oldiga qo'yish), ostiga (keyiniga) va o'rtasiga (ichki menyuga
solish) — ya'ni «tartibni o'zgartirish» va «ichiga solish» bitta harakatda
ajratiladi. Ota/bola munosabati avtomatik saqlanadi. Sensorli ekranlarda
sudrash ishonchsiz bo'lgani uchun ko'chirishning tugmali yo'li ham bor.

**Navigatsiya.** Tugma bosilganda yangi xabar yuborilmaydi — `editMessageText`
bilan o'sha xabar yangilanadi, foydalanuvchi bitta «ekran»da yuradi va chat
to'lib ketmaydi. `⬅️ Ortga` har menyuning otasiga qaytaradi (manzil callback
ichida turgani uchun juda eski xabarlarda ham to'g'ri ishlaydi), `🏠 Bosh
menyu` — ildizga. Ikkinchi qatlamdan boshlab ikkalasi ham chiqadi, ya'ni
istalgan chuqurlikdan bitta bosishda ildizga qaytish mumkin.

**Amallar.** Bajariladiganlari: matn yuborish, ichki menyu, kategoriya,
mahsulot, savatchaga qo'shish, savatcha, buyurtma, buyurtmalarim, sevimlilar,
profil, yordam, orqaga, bosh menyu, menyuni yopish, havola, mini app,
telefon/manzil/ism/email so'rash, tilni o'zgartirish, adminga yozish, custom.

**Tizim ekranlari.** Savatcha, buyurtmalar, sevimlilar, profil, sozlamalar va
yordam daraxtda yozilmaydi — ular tayyor ekran bo'lib keladi, egasi faqat
tugmani qo'yadi (`🛒 Savatcha`, `📦 Buyurtmalarim`, `❤️ Sevimlilar`,
`👤 Profil`, `ℹ️ Yordam`). Bir xil ekranlar `/savat`, `/buyurtmalar`,
`/sevimlilar`, `/profil`, `/yordam` buyruqlari bilan ham ochiladi, ya'ni
tugma qo'yilmagan botda ham foydalanuvchi javobsiz qolmaydi.

  * **Savatcha** — raqamlangan qatorlar, har biriga `➖ ➕ 🗑`, jami summa,
    `✅ Buyurtma berish` va `➕ Mahsulot qo'shish` (katalogga qaytaradi).
  * **Buyurtmalarim** — oxirgi 10 buyurtma holat belgisi bilan
    (`🟡 Kutilmoqda`, `🔵 Tayyorlanmoqda`, `🚚 Yetkazilmoqda`, `🟢 Yetkazildi`,
    `🔴 Bekor qilingan`); har biri bosilganda tafsilot ochiladi. Yozuv
    `botId` **va** foydalanuvchi bo'yicha izlanadi, begona raqam natija
    bermaydi.
  * **Sevimlilar** — mahsulot kartasidagi `❤️` bilan yig'iladi, ro'yxatdan
    to'g'ridan-to'g'ri kartaga o'tiladi.
  * **Profil** — ism, telefon, email, til; ostida buyurtmalar, sevimlilar va
    sozlamalar. Sozlamalarda til, ism va telefon o'zgartiriladi; ma'lumot
    saqlangach foydalanuvchi profilga qaytadi.

**Mahsulot kartasi.** Nomi, tavsifi, narxi va ombor holati (`🟢 Mavjud` /
`🔴 Omborda yo'q`), rasm havolasi berilgan bo'lsa `🖼 Rasmni ko'rish`, `❤️`
tugmasi va savatcha boshqaruvi. Mahsulot savatchada bo'lsa karta miqdorni
ko'rsatadi (`🛒 Savatchada: 2 ta`) va shu tugma savatchani ochadi — «qo'shdim,
endi qayerda?» degan savol qolmaydi.

**Bo'sh holatlar.** Savatcha, buyurtmalar, sevimlilar va bo'sh bo'lim bir xil
qoidada ishlaydi: nima bo'layotganini aytadi va keyingi qadamni taklif qiladi
(`🛍 Mahsulotlarni ko'rish`). Menyu hali nashr etilmagan bo'lsa `/start`
javobida botning holati ko'rinadi, jim bo'sh ekran chiqmaydi.

**Qoralama va nashr.** Tahrir qoralamaga tushadi, jonli bot esa oxirgi
**nashr etilgan** suratda ishlaydi. «Nashr etish» avval daraxtni tekshiradi:
xatolar nashrni to'xtatadi (halqa, mavjud bo'lmagan yoki o'ziga/avlodiga
ulangan menyu, `callback_data` cheklovi, takrorlangan callback), ogohlantirishlar
esa yo'q (yaroqsiz URL yoki rasm, narxsiz mahsulot, bo'sh menyu, aralash
klaviatura, qatorda ortiqcha tugma, mahsulot bor-u savatcha tugmasi yo'q). Har nashr versiya bo'lib saqlanadi va bir bosishda
qaytariladi; o'zgarish bo'lmasa yangi versiya yaratilmaydi.

**Tayyor shablonlar.** Do'kon, restoran, xizmat va hamjamiyat uchun ichma-ich
menyuli shablonlar bir bosishda qoralamaga tushadi.

**Tezlik.** Nashr etilgan daraxt jarayon xotirasida keshlanadi (60 s TTL,
nashrda darhol tozalanadi) — tugma bosilishidan javobga qadar bazaga
qo'shimcha so'rov ketmaydi.

**Xavfsizlik.** `callback_data` ichida faqat ma'nosiz ko'rsatgich turadi:
foydalanuvchi id'si, narx yoki token yo'q. Amal callback'dan **olinmaydi** —
server tugmani nashr etilgan daraxtdan topadi va ko'rinish qoidalarini
(auditoriya, shartlar, `adminOnly`) har bosishda qaytadan tekshiradi. Shu
sababli payload'ni qo'lda yasab ruxsatsiz amalni chaqirib bo'lmaydi.

**Xatolar.** O'chirilgan menyu yoki eskirgan callback bosilganda foydalanuvchi
`⬅️ Ortga` va `🏠 Bosh menyu` tugmalari bilan tushunarli xabar oladi — texnik
tafsilot chiqmaydi. Tanilmagan matn ham javobsiz qolmaydi: bot bosh menyuni
qaytaradi. Uzoq amallarda (buyurtmalarni o'qish, tasdiqlash) «yozmoqda»
belgisi ko'rsatiladi.

---

## Shablonlar — «Shablonlar»

Tayyor bot turlari katalogi (`/templates`). Ma'lumot `lib/ai/recipes.ts` dan —
ya'ni AI ishlamaganda zaxira generator ishlatadigan AYNAN O'SHA retseptlardan.
Katalog ikki joyda takrorlanmaydi: yangi retsept qo'shilsa sahifada o'zi
paydo bo'ladi.

Turkumlar (`lib/ai/template-catalog.ts`): Savdo · Ovqat · Xizmatlar · Ta'lim ·
Qo'llab-quvvatlash · Boshqa. Noma'lum biznes turi `other` ga tushadi, shuning
uchun yangi retsept hech qachon katalogdan yo'qolmaydi.

«Shablondan foydalanish» → `/build?template=<id>` — mavjud yaratish oqimining
o'zi, shablon oldindan tanlangan holda. Yangi mexanizm qo'shilmaydi.

---

## Botni nusxalash — konfiguratsiyadan

Telegram botining O'ZINI ikkilantirib bo'lmaydi: har bir bot @BotFather bergan
yagona tokenga bog'langan va `telegramBotId` bazada `@unique`. Shuning uchun
«Duplicate» boshqa narsani qiladi.

**Ko'chadi:** menyu daraxti, tugmalar, buyruqlar, javob matnlari, bot profili
(nom, tavsif, kategoriya, funksiyalar) va AI sozlamasi.

**Ko'chMAYDI:** Telegram tokeni va boshqa sirlar, webhook sozlamasi, bot
foydalanuvchilari, xabarlar tarixi va analitika.

Natija — jonli bot emas, **qoralama reja** (`bot_blueprints`). Foydalanuvchi
`/build/<planId>` da o'zining yangi tokenini ulaydi va reja botga aylanadi.
Ya'ni nusxalash mavjud oqimga tushadi; «tokensiz yarim bot» degan yangi holat
o'ylab topilmaydi.

Reja sxemasi ikki qatlam bilan cheklangan. Undan chuqur shoxlar nusxaga
tushmaydi, lekin **jim yo'qolmaydi**: ular sanaladi va UI'da ochiq aytiladi
(`droppedDeeper`).

---

## Yordam — «Yordam»

`/help`. Tepada — eng ko'p to'xtatib qo'yadigan savol («tokenni qayerdan
olaman?») ochiq holda, `BotFatherSteps` bilan. Pastda bo'limlar bo'yicha yo'l
va savol-javob (`<details>` — JS'siz ham ochiladi, klaviaturadan yuriladi).

---

## Analitika — «Analitika»

Ish maydonidagi **o'z botlaringiz** bo'yicha ko'rsatkichlar (`/analytics`).
Admin panelidagi analitika (`/admin/analytics`) butun platformani sanaydi;
bu sahifa esa faqat shu workspace botlarini — har bir so'rov `botId in (…)`
bilan cheklanadi, begona ish maydonining raqami hech qachon ko'rinmaydi.

Davr filtri: **Bugun · 7 kun · 30 kun · 90 kun**.

| Ko'rsatkich | Manba |
|---|---|
| Bot foydalanuvchilari, yangi va faol | `telegram_bot_users` |
| Xabarlar (kiruvchi / chiquvchi) | `telegram_bot_messages` |
| Tugma bosishlari | `telegram_bot_button_events` (`eventType = click`) |
| Eng ko'p bosilgan tugmalar | `groupBy(buttonId)` + tugma nomi |
| Eng ko'p ishlatilgan buyruqlar | `messageType = command` |
| Botlar bo'yicha taqsimot | `groupBy(botId)` |

Hech qanday faollik bo'lmasa nol to'la jadval o'rniga bo'sh holat
ko'rsatiladi — nollar foydalanuvchiga hech narsa aytmaydi.

---

## API kalitlari — «API kalitlari»

Tashqi tizim Qara API'siga shu kalit bilan kiradi (`/api-keys`).

**Ochiq matn kalit bazaga YOZILMAYDI.** Saqlanadigan narsa — SHA-256 xesh,
ko'rsatish uchun prefiks va oxirgi 4 belgi. Shuning uchun:

- to'liq qiymat foydalanuvchiga **faqat bir marta**, yaratilgan paytdagi
  modalda ko'rsatiladi va boshqa hech qayerdan olib bo'lmaydi;
- ro'yxatda faqat `qara_sk_••••••9xYz` ko'rinadi;
- baza sizib chiqsa ham kalitlar ishlatib bo'lmaydigan holda qoladi.

Nega bcrypt emas, SHA-256? Kalit — parol emas, 32 baytlik tasodifiy qiymat,
lug'at hujumi ma'nosiz. Xesh bo'yicha unique indeks bilan tekshiruv bitta
so'rovda ketadi; bcrypt bo'lsa har bir yozuvni navbatma-navbat sinash
kerak bo'lardi.

Amallar: **yaratish · nomini o'zgartirish · bekor qilish · o'chirish**.
Bekor qilingan kalit yozuv sifatida qoladi (audit uchun), lekin qayta
yoqilmaydi — oshkor bo'lgan kalit oshkor bo'lganicha qoladi.

Huquq: `apikey:read` va `apikey:manage` — faqat `owner` va `admin`. `editor`
va quyi rollar bu sahifani umuman ko'rmaydi, chunki kalit bot tokeni bilan
bir darajadagi sir. Bir ish maydonida ko'pi bilan 25 ta faol kalit.

---

## Mini App — Telegram ichidagi veb-sahifa

Tugmalar va menyular chat oqimi uchun. **Mini App** esa boshqa narsa: bot
ichida ochiladigan to'liq veb-sahifa (katalog, forma, buyurtma oynasi). U ham
konstruktordan yig'iladi — kod yozilmaydi.

Manzil: **Bot sahifasi → Mini App**.

### Konstruktor

Uch ustun: chapda komponentlar, o'rtada jonli ko'rinish, o'ngda tanlangan
elementning sozlamalari. Ko'rinish `RenderTree` bilan chiziladi — Telegram
ochadigan kod bilan **bitta**, shuning uchun preview yolg'on gapirmaydi.

**Komponentlar:** sarlavha, matn, rasm, tugma, kiritish maydoni, mahsulot
kartasi, ajratgich, bo'shliq, konteyner.

**Ichma-ich tuzilma.** Konteyner tanlanganda keyingi qo'shilgan element uning
ICHIGA tushadi — alohida rejim yoqish shart emas. Chapdagi «Tuzilma» ro'yxati
ierarxiyani ochiq ko'rsatadi va istalgan qavatdagi elementni tanlashga imkon
beradi. Chuqurlik 4 qavat bilan cheklangan.

```
Konteyner
├── Sarlavha
├── Matn
├── Rasm
└── Tugma
```

**Amallar:** sahifani ochish, havolani ochish, botga xabar yuborish, formani
yuborish, **API so'rovi**, Mini App'ni yopish. Har biri oxirigacha ishlaydi —
yarim bajariladigan amal ro'yxatga qo'shilmagan.

### Forma va validatsiya

Kiritish maydoniga qoidalar qo'yiladi: majburiylik, eng kam/ko'p belgi, tur
(`email`, `number`, `tel`) va ixtiyoriy regex naqsh.

Validatsiya `lib/mini-app/validate-form.ts` da — **bitta sof funksiya**, u ham
Mini App'da (foydalanuvchi darhol xatoni ko'radi), ham serverda ishlaydi.
Klientdagi tekshiruv chetlab o'tilishi mumkin, shuning uchun server uni
nashr etilgan suratdagi qoidalar bo'yicha qaytadan bajaradi.

### API amallari

Mini App tugmasi tashqi API'ga so'rov yuborishi mumkin. Amallar bot
sahifasidagi **«API amallari»** bo'limida sozlanadi: metod, manzil,
sarlavhalar, so'rov tanasi shabloni (`{{maydon}}`) va javob xaritasi.

**Eng muhim qaror: manzilni klient bermaydi.** Mini App faqat amalning
id'sini yuboradi, manzil va sarlavhalar (API kalitlari bilan birga) serverda
qoladi. Shu sababli foydalanuvchi ixtiyoriy manzilga so'rov yubora olmaydi.

Sarlavha qiymatlari hech qachon qaytarilmaydi — konstruktorda faqat kalit
nomlari ko'rinadi.

#### SSRF himoyasi

`lib/mini-app/ssrf.ts` — ikki qavat:

1. **Tuzilma tekshiruvi** — saqlashda ham, so'rovdan oldin ham: faqat HTTPS,
   faqat 443-port, `localhost` / `.internal` / `.local` yopiq, login-parolli
   manzil yopiq, to'g'ridan-to'g'ri ichki IP yopiq.
2. **DNS tekshiruvi** — har so'rovdan oldin: domen yechilgan HAMMA manzil
   ochiq bo'lishi shart. Bittasi ichki bo'lsa so'rov to'xtaydi.

Yopiq diapazonlar: `10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`
(AWS/GCP/Azure metadata), `100.64/10` (CGNAT va Alibaba metadata), multicast,
rezerv, hamda IPv6 `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, NAT64 va
IPv4-mapped shakllari.

Qo'shimcha chora: **qayta yo'naltirish yo'q** (`redirect: "manual"`) — aks
holda tashqi server bizni ichki manzilga burib yuborardi. Timeout majburiy,
javob 64 KB bilan cheklangan va faqat JSON o'qiladi.

**Domen ro'yxati (allowlist)** — eng qattiq rejim. To'ldirilsa faqat shu
domenlarga (va ularning subdomenlariga) chiqiladi. Ishlab chiqarishda
to'ldirish tavsiya etiladi.

> **DNS rebinding.** To'liq yopish uchun yechilgan IP'ga to'g'ridan-to'g'ri
> ulanish kerak bo'lardi, bu esa TLS sertifikatini buzadi. Shuning uchun
> amaliy chora qo'llangan: hamma yechilgan manzil tekshiriladi, qayta
> yo'naltirish yopiq va timeout qisqa — bu oynani juda tor qiladi, lekin
> nazariy jihatdan nolga tushirmaydi.

### Ko'rsatkichlar

Bot sahifasidagi **«Ko'rsatkichlar»** paneli `mini_app_events` jadvalidan
o'qiydi: ochilishlar, noyob foydalanuvchilar, sahifa ko'rishlar, tugma
bosishlar, API so'rovlari, xatolar va oxirgi 20 hodisa. Ma'lumot bo'lmasa
bo'sh holat chiqadi — **soxta yoki «namuna» raqam ko'rsatilmaydi**.

Hodisa yozuvlari ham `initData` imzosi bilan himoyalangan: aks holda istalgan
odam ko'rsatkichlarni shishira olardi.

**Sahifalar.** Bir nechta sahifa quriladi (`home`, `products`, …), bittasi bosh
sahifa bo'ladi. Navigatsiya Telegram'ning o'z `BackButton` tugmasi bilan
ishlaydi.

### Qoralama va nashr

Tugmalar tizimidagi bilan bir xil qoida: tahrir `mini_app_pages` ga tushadi,
Telegram esa faqat oxirgi **nashr etilgan** suratni (`mini_app_deployments`)
o'qiydi. Nashr etilmagan yoki nashrdan olingan ilova manzili `404` qaytaradi.

Nashrdan oldin tekshiriladi: bosh sahifa bormi, tugmalar mavjud sahifaga
ulanganmi, havolalar HTTPS'mi. Xato bo'lsa nashr to'xtaydi.

### Autentifikatsiya — `initData`

Mini App ochilganda `Telegram.WebApp.initData` serverga yuboriladi va u yerda
**HMAC-SHA256** bilan tekshiriladi (`lib/mini-app/auth.ts`):

```
secret_key = HMAC_SHA256(key="WebAppData", message=<bot_token>)
computed   = HMAC_SHA256(key=secret_key, message=<data_check_string>)
```

Imzo mos kelmasa so'rov rad etiladi. `auth_date` 24 soatdan eski bo'lsa ham
rad etiladi. **`initDataUnsafe` hech qachon ishlatilmaydi** — uni klient
o'zgartira oladi.

Tanilgan foydalanuvchi botning mavjud `telegram_bot_users` yozuviga tushadi —
Mini App uchun alohida jadval yo'q, shuning uchun chatdagi va Mini App'dagi
odam bitta yozuv bo'lib qoladi.

Bot tokeni faqat serverda o'qiladi va klientga hech qachon chiqmaydi. Shu
sababli «botga xabar yuborish» ham server orqali ketadi
(`POST /api/mini-app/<appId>/send`), `Telegram.WebApp.sendData()` emas — u
faqat reply klaviaturadan ochilgan Mini App'da ishlaydi.

### Botga ulash

Bot sahifasidagi **«Botga ulash»** panelida uch mustaqil nuqta bor:

| Nuqta | Qanday ishlaydi |
|---|---|
| Menyu tugmasi | Telegram'da darhol — `setChatMenuButton` |
| Inline tugma | Qoralamaga tushadi, «Nashr etish» bilan chiqadi |
| Klaviatura tugmasi | Qoralamaga tushadi, «Nashr etish» bilan chiqadi |

### Xavfsizlik sarlavhalari

Dashboard `frame-ancestors 'none'` va `X-Frame-Options: DENY` bilan qulflangan.
Telegram esa Mini App'ni **iframe** ichida ochadi, shuning uchun `proxy.ts`
faqat `/mini-app/*` yo'liga alohida siyosat qo'yadi: `frame-ancestors` yopiq
ro'yxat bilan Telegram manbalariga ochiladi va `script-src` ga
`https://telegram.org` qo'shiladi (SDK shu yerdan yuklanadi). Boshqa hech
narsa o'zgarmaydi.

### Haqiqiy Telegram bilan sinash — qo'lda protsedura

Avtomatik sinovlar `initData` imzosini, SSRF himoyasini va butun nashr
oqimini qamraydi (`npm test`, `npm run test:e2e`), lekin **Telegram
mijozining o'zini almashtira olmaydi**: `@BotFather` da bot yaratish va
Telegram ichida ochish qo'lda bajariladi. Quyidagi ro'yxat aynan shu uchun.

**Tayyorgarlik**

```bash
# 1. @BotFather → /newbot → tokenni .env ga qo'ying (KODGA YOZMANG)
#    TELEGRAM_BOT_TOKEN="123456:AA…"

# 2. HTTPS tunnel — Telegram HTTP manzilni ochmaydi
ngrok http 3000              # yoki: cloudflared tunnel --url http://localhost:3000

# 3. Berilgan HTTPS manzilni .env dagi APP_URL ga yozing va serverni qayta ishga tushiring
#    APP_URL="https://xxxx.ngrok-free.app"
npm run dev
```

**Oqim**

| # | Qadam | Kutilgan natija |
|---|---|---|
| 1 | `Botlarim` → **Bot ulash**, @BotFather tokenini qo'ying | Bot `Ishlayapti` holatiga o'tadi |
| 2 | Bot sahifasi → **Mini App** → «Mini App yaratish» | Bo'sh «Bosh sahifa» bilan konstruktor ochiladi |
| 3 | Sahifa qo'shing, konteyner + ichiga sarlavha/tugma joylang | Preview'da darhol ko'rinadi |
| 4 | **Saqlash** → **Nashr etish** | Versiya raqami va public manzil chiqadi |
| 5 | **Botga ulash** → «Menyu tugmasi» yoqing | Telegram `setChatMenuButton` ga so'rov ketadi, xato bo'lsa sababi ko'rinadi |
| 6 | «Inline tugma» va «Klaviatura tugmasi» yoqing → **Nashr etish** | Tugmalar botning menyusiga chiqadi |
| 7 | Telegramda botni oching, `/start` yozing | Menyu chiqadi |
| 8 | Chatdagi **«≡»** tugmasini bosing | Mini App ochiladi |

**Telegram ichida tekshirilishi kerak**

- [ ] Mini App ochiladi (oq ekran emas)
- [ ] Telegram SDK yuklandi — `telegram-web-app.js` tarmoqda `200`
- [ ] Mavzu Telegram'niki bilan bir xil; **Sozlamalar → Tungi rejim** ni
      almashtirsangiz ranglar darhol o'zgaradi (`themeChanged`)
- [ ] Foydalanuvchi tanildi — «Telegram tashqarisida ochildi» ogohlantirishi
      **CHIQMAYDI** (chiqsa `initData` serverga yetmagan)
- [ ] `initData` backendga bordi — server logida `POST /api/mini-app/…/session` `200`
- [ ] Ikkinchi sahifaga o'tsangiz Telegram'ning **BackButton** i paydo bo'ladi
      va orqaga qaytaradi
- [ ] `MainButton` matni sozlangan bo'lsa pastda chiqadi va ishlaydi
- [ ] Safe-area: iPhone'da yuqoridagi «chelak» va pastdagi chiziq matnni kesmaydi
- [ ] Gorizontal skroll YO'Q
- [ ] Forma to'ldirib «Botga xabar yuborish» bosilsa — xabar chatga tushadi
- [ ] Inline tugma va klaviatura tugmasi ham Mini App'ni ochadi

**Muvaffaqiyatsiz bo'lsa**

| Belgi | Sabab |
|---|---|
| Oq ekran, konsolda `frame-ancestors` xatosi | `APP_URL` `/mini-app/*` ga to'g'ri kelmayapti — proxy siyosatini tekshiring |
| «Telegram ulanishi tasdiqlanmadi» | Token `.env` dagi bilan bir xil emas yoki soat noto'g'ri (`auth_date`) |
| Menyu tugmasi o'rnatilmadi | Javobdagi sabab ko'rsatiladi (odatda `Unauthorized` — token noto'g'ri) |
| Tugma bosilganda hech narsa bo'lmaydi | Amal `Hech narsa` da qolgan yoki nashr etilmagan |

### `answerWebAppQuery` — nega ishlatilmagan

`answerWebAppQuery` faqat **inline rejimdan** ochilgan Mini App uchun kerak:
u foydalanuvchi nomidan chatga natija xabarini joylaydi.

Bu arxitekturada Mini App uch yo'ldan ochiladi — menyu tugmasi, inline tugma
va klaviatura tugmasi — va ularning hech biri inline query emas. Botga xabar
`POST /api/mini-app/<appId>/send` orqali, server tomonda bot tokeni bilan
yuboriladi; bu uch holatda ham bir xil ishlaydi (`Telegram.WebApp.sendData()`
esa faqat klaviatura tugmasidan ochilganda javob qaytaradi).

Shuning uchun `answerWebAppQuery` **ataylab qo'shilmagan**. U kerak bo'ladigan
yagona holat: botga inline rejim qo'shilib, `switch_inline_query` natijalari
ichida Mini App ochiladigan bo'lsa.

### Cheklovlar

- **HTTPS majburiy.** `APP_URL` HTTPS bo'lmasa Mini App yaratiladi va
  konstruktorda ishlaydi, lekin Telegram uni ocha olmaydi — botga ulash
  bloklanadi va UI buni ochiq aytadi. Lokal sinov uchun tunnel oching.
- **Haqiqiy Telegram mijozida sinalmagan.** Yuqoridagi protsedura shu uchun
  yozilgan; kod tomoni (imzo, CSP, nashr, ulash) avtomatik sinovdan o'tgan.
- Konteyner ichida elementni sudrab ko'chirish yo'q — tartib `↑ ↓` tugmalari
  bilan o'zgartiriladi.
- API amali javobidan faqat oddiy qiymatlar ko'rsatiladi; ro'yxatni
  komponentga aylantirish (repeater) qo'shilmagan.
- Mini App sahifasi ildiz layout orqali dashboard i18n lug'atini olib yuradi
  (~4 KB gzip). Buni ajratish uchun `I18nProvider` ni guruh layout'lariga
  ko'chirish kerak — ishlayotgan kodni o'zgartirmaslik uchun qilinmadi.
- `answerWebAppQuery` yo'q (yuqoriga qarang — ataylab).

---

> **Diqqat.** Sxemada AI javoblari, bilim bazasi, veb-qidiruv, integratsiya va
> workflow'lar uchun jadvallar bor, lekin ularning mantig'i hali yozilmagan.
> Bunday amallarni tanlash va saqlash mumkin, ammo bosilganda foydalanuvchiga
> ochiq «hali sozlanmagan» javobi ketadi — jim yiqilmasin.

---

## Loyiha tuzilishi

```
app/
  page.tsx                     landing
  (auth)/login|signup          kirish / ro'yxatdan o'tish
  (app)/dashboard              chat + Telegram bog'lash
  (app)/bots                   bot konstruktori: ro'yxat va sozlash
  (app)/bots/[botId]/mini-app  Mini App konstruktori
  mini-app/[appId]             Telegram ochadigan Mini App (ochiq yo'l)
  (app)/profile                profil, bildirishnomalar, eksport, o'chirish
  (app)/admin                  foydalanuvchilar, bot sozlamalari, xabar jurnali
  (app)/analytics              o'z botlaringiz bo'yicha ko'rsatkichlar
  (app)/templates              shablonlar katalogi
  (app)/help                   yordam markazi
  (app)/api-keys               API kalitlari: yaratish, bekor qilish
  (app)/admin/analytics        platforma grafiklari (faqat admin)
  (legal)/privacy|terms        huquqiy sahifalar (namuna)
  api/
    auth/{register,login,logout,google,google/callback}
    telegram/{webhook,link,simulate}
    telegram/bots/[botId]      foydalanuvchi botlarining webhook'i
    bots, bots/[botId]         bot CRUD
    bots/[botId]/{webhook,commands,simulate}
    bots/[botId]/buttons       tugma daraxti: CRUD, reorder,
                               publish, versions, templates
    keys, keys/[keyId]         API kalitlari
    bots/[botId]/duplicate     sozlamadan nusxa (qoralama reja)
    messages, profile, profile/export, lang
    admin/{users,bot}
lib/
  auth.ts        sessiya, parol, CSRF
  google.ts      OAuth 2.0 + id_token tekshiruvi
  telegram.ts    Bot API klienti (+ mock) — Qara'ning o'z boti
  bot-handler.ts Qara botining mantig'i (webhook va simulyator uchun umumiy)
  crypto.ts      AES-256-GCM shifrlash, maskalash, log redaction
  api-keys.ts    API kalitlari (SHA-256 xesh; ochiq matn saqlanmaydi)
  bots/
    service.ts     bot hayot tsikli: yaratish, webhook, token, o'chirish
    runtime.ts     foydalanuvchi botlariga kelgan update'ni qayta ishlash
    telegram-api.ts har bir bot o'z tokeni bilan chaqiradigan Bot API klienti
    secrets.ts     sirlarni yozish/o'qish (ochiq matn shu moduldan chiqmaydi)
    audit.ts       audit jurnali va texnik hodisalar
    transport.ts   botga javob qaytarish yo'li (Telegram yoki sinov oynasi)
    idempotency.ts takroriy yetkazilgan update'ni to'xtatish
    analytics.ts   ish maydoni ko'rsatkichlari (§22)
    list-filter.ts «Botlarim» ro'yxatini qidirish/filtrlash/saralash
    duplicate.ts   sozlamadan nusxa: bot daraxti → qoralama reja
    buttons/
      types.ts       tugma turlari, amallar, Telegram cheklovlari
      menu.ts        daraxt yordamchilari: bolalar, yo'l, ichki daraxt
      navigation.ts  ekranlar: menyu, mahsulot, savatcha, buyurtmalar,
                     sevimlilar, profil, yordam, xato holatlari
      compiler.ts    daraxtdan Telegram klaviaturasini yig'ish
      callback.ts    `callback_data` kodlash/o'qish va cheklov tekshiruvi
      router.ts      bosishni ekranga ulaydi (xabarni joyida tahrirlaydi)
      actions.ts     amallarni bajarish
      cart.ts        savatcha holati, miqdor va summa
      favorites.ts   sevimlilar ro'yxati
      orders.ts      buyurtma holatlari va matni
      visibility.ts  tugma kimga ko'rinadi (auditoriya, shartlar, admin)
      validate.ts    daraxt tekshiruvi: xatolar va ogohlantirishlar
      store.ts       qoralama/nashr, versiyalar, farq, statistika
      cache.ts       nashr etilgan daraxt keshi
      templates.ts   tayyor menyu shablonlari
      strings.ts     botning uch tildagi matnlari
  mini-app/
    auth.ts        `initData` imzosini tekshirish (HMAC-SHA256)
    schema.ts      komponent sxemasi — konstruktor, runtime va API uchun umumiy
    service.ts     Mini App hayot tsikli: sahifalar, nashr, endpointlar, analitika
    launch.ts      botga ulash: menyu / inline / klaviatura tugmasi
    ssrf.ts        API chaqiruvlari uchun SSRF himoyasi (URL + DNS)
    api-action.ts  tashqi API so'rovini bajarish (timeout, redirect yo'q)
    validate-form.ts  forma qoidalari — runtime va serverda bitta funksiya
    telegram-sdk.ts  `window.Telegram.WebApp` ustidan tiplangan qatlam
  api.ts         guard, rate limit, validatsiya, sanitizatsiya
  stats.ts       analitika so'rovlari
  i18n/          uz / ru / en lug'atlari
components/      UI, chat, grafiklar, admin jadvallari
  bots/          bot ro'yxati va sahifasi
    button-builder.tsx  menyu konstruktori (daraxt + sozlamalar + preview)
    menu-tree.tsx       daraxt, sudrab ko'chirish bilan
    telegram-preview.tsx  jonli Telegram ko'rinishi
prisma/          schema.prisma, migratsiyalar, seed.ts
tests/buttons/   tugma tizimi testlari (`npm test`)
proxy.ts         xavfsizlik sarlavhalari (CSP, HSTS, …)
```

### Ma'lumot modeli

`users`, `telegram_links`, `messages`, `sessions`, `analytics`, `bot_settings`
— texnik topshiriqdagi ER-diagrammaga muvofiq. Bot konstruktori esa
`telegram_bots` va unga bog'langan jadvallarda (`…_secrets`, `…_commands`,
`…_buttons`, `…_button_versions`, `…_button_events`, `…_users`, `…_messages`,
`…_events`, `…_audit_logs` va b.). Menyu daraxti alohida jadval emas:
`telegram_bot_buttons` dagi `parentId` orqali istalgan chuqurlikda quriladi,
`…_button_versions` esa har nashrning suratini saqlaydi.
To'liq ta'rif:
[`prisma/schema.prisma`](prisma/schema.prisma).

---

## Xavfsizlik

| Chora | Amalga oshirilishi |
|---|---|
| Parollar | bcrypt, 12 rounds; login javobi vaqti bo'yicha email mavjudligi oshkor bo'lmaydi |
| Sessiya | Bazadagi yozuv + imzolangan JWT httpOnly cookie'da; server tomondan bekor qilinadi |
| CSRF | Double-submit token; har bir o'zgartiruvchi so'rovda `X-CSRF-Token` |
| Rate limit | Login 10/daq, ro'yxatdan o'tish 5/daq, xabar 20/daq, bot uchun sozlanadigan |
| Webhook | `X-Telegram-Bot-Api-Secret-Token` tekshiruvi; foydalanuvchi botlarida har biriga alohida secret va `timingSafeEqual` |
| OAuth | `state` cookie bilan solishtiriladi; `id_token` JWKS orqali tekshiriladi |
| Sarlavhalar | CSP, HSTS (prod), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy |
| Sirlar | Bot tokeni va OAuth kalitlari faqat serverda; klientga hech qachon yuborilmaydi |
| Mini App | `initData` HMAC-SHA256 bilan tekshiriladi, `auth_date` 24 soat bilan cheklangan; `initDataUnsafe` ishlatilmaydi; nashr etilmagan ilova `404` |
| Foydalanuvchi botlari tokeni | AES-256-GCM bilan shifrlanadi (`SECRETS_KEY`); UI'ga faqat `1234••••••xYz` ko'rinishidagi maska chiqadi |
| Loglar | Token va API kalitlari audit yozuvlari, hodisalar va xato matnlaridan `redactSecrets` bilan olib tashlanadi |
| Egalik | Har bir bot so'rovi egasi bo'yicha tekshiriladi; begona bot uchun «topilmadi» qaytadi (mavjudligi oshkor bo'lmaydi) |

**Ishlab chiqarishga chiqishdan oldin:**

- `AUTH_SECRET`, `TELEGRAM_WEBHOOK_SECRET` va `SECRETS_KEY` ni yangi qiymatlar
  bilan almashtiring (`.env` hech qachon git'ga tushmasin).
- `SECRETS_KEY` ni alohida belgilang. Bo'sh qoldirilsa kalit `AUTH_SECRET` dan
  hosil qilinadi — u almashsa saqlangan bot tokenlari ochilmay qoladi va
  egalari tokenni qaytadan kiritishi kerak bo'ladi.
- Rate limiter hozir jarayon xotirasida ishlaydi — bir nechta instansda
  ishlatilganda uni Redis'ga ko'chiring (`lib/api.ts` → `rateLimit`).
- Xato kuzatuvini ulang (Sentry va sh.k.) — `app/error.tsx` da joyi belgilangan.

---

## GDPR / PDPA

- **Eksport**: Profil → «Ma'lumotlarimni eksport qilish» barcha yozuvlarni JSON
  faylda beradi (`/api/profile/export`).
- **O'chirish**: Profil → «Hisobni o'chirish» — hisob va unga bog'liq barcha
  yozuvlar cascade bilan o'chadi.
- `app/(legal)/privacy` va `terms` sahifalari **namuna** matn — ishga
  tushirishdan oldin huquqshunos bilan ko'rib chiqing.
- O'zbekistonda ZRU-547 bo'yicha shaxsiy ma'lumotlar bazasini ro'yxatdan
  o'tkazish va ma'lumotlarni mamlakat hududida saqlash talabi alohida
  hal qilinishi kerak.

---

## Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Prod build va ishga tushirish |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` | Sof modul testlari — bazasiz (tugmalar, Mini App imzosi, SSRF) |
| `npm run test:e2e` | Mini App uchdan-uchgacha oqimi — **baza talab qiladi** |
| `npm run db:migrate` | Migratsiya yaratish va qo'llash |
| `npm run db:deploy` | Migratsiyalarni prod'da qo'llash |
| `npm run db:seed` | Demo ma'lumot |
| `npm run bot:poll` | Foydalanuvchi botlarini polling rejimida ishlatish (lokal, tunnel'siz) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Bazani tozalab qayta qurish |

---

## Deploy

Ilova standart Next.js ilovasi — Vercel, Render, Railway, Fly.io yoki Docker
bilan istalgan VPS'ga chiqadi.

1. Muhit o'zgaruvchilari: `DATABASE_URL`, `AUTH_SECRET`, `SECRETS_KEY`,
   `APP_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
   `TELEGRAM_WEBHOOK_SECRET`, (ixtiyoriy) `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.
2. Build: `npm run build`, ishga tushirish: `npm start`.
3. Birinchi deploydan keyin: `npm run db:deploy`.
4. `APP_URL` HTTPS bo'lgach — Admin → Bot sozlamalari → `setWebhook`.
5. Foydalanuvchi botlari: `APP_URL` o'zgarsa, har bir botning webhook manzili
   ham o'zgaradi — bot sahifasidan **«O'rnatish»** ni qayta bosish kerak.

Postgres uchun boshqariladigan xizmat tavsiya etiladi (Neon, Supabase, RDS,
DigitalOcean Managed DB).

---

## Ma'lum cheklovlar

- Chat yangi xabarlarni **3 soniyalik polling** bilan oladi. Katta yuklamada
  buni SSE yoki WebSocket'ga o'tkazish kerak.
- Rasm va hujjatlar Telegramdan **matn tavsifi** sifatida saqlanadi
  (`[rasm]`, `[hujjat: …]`); fayllarni yuklab olish qo'shilmagan.
- Email bildirishnomalari uchun sozlama bor, lekin pochta jo'natish provayderi
  (SendGrid / Mailgun) ulanmagan.
- Testlar ikki qatlamda: `npm test` — sof modullar, bazasiz (tugma/menyu
  tizimi, `initData` imzosi, SSRF himoyasi); `npm run test:e2e` — Mini App
  oqimi haqiqiy baza bilan (yaratish → nashr → autentifikatsiya → API amali →
  nashrdan olish, hamda izolyatsiya va xavfsizlik holatlari).
  Auth, chat va admin oqimlari uchun test yozilmagan.

**Bot konstruktori bo'yicha:**

- Sxemada AI javoblari (`telegram_bot_ai_configs`), veb-qidiruv, bilim bazasi,
  integratsiyalar va workflow'lar uchun jadvallar tayyor, ammo ularning
  mantig'i **hali yozilmagan** — bunday amal bosilganda bot «hali sozlanmagan»
  deb javob beradi.
- Savat va buyurtma ishlaydi, lekin **to'lov provayderi ulanmagan**: buyurtma
  `telegram_bot_payments` ga `pending` holatida yoziladi va foydalanuvchiga
  raqami ko'rsatiladi, pul o'tkazish bosqichi yo'q.
- Mahsulot va kategoriyalar alohida katalog emas — menyu daraxtining o'zida
  tugma sifatida turadi. Ombor qoldig'i bor, variantlar (o'lcham, rang)
  qo'shilmagan.
- Mahsulot rasmi kartaga havola tugmasi (`🖼 Rasmni ko'rish`) bo'lib chiqadi:
  bitta xabarni joyida tahrirlash oqimini saqlash uchun karta matnli xabar
  bo'lib qoladi.
- Buyurtma holatini o'zgartiradigan admin ekrani yo'q — yozuv `pending` da
  turadi, holat bazadan qo'lda yangilanadi (ekran barcha holatlarni
  ko'rsatishga tayyor).
- Savatcha va sevimlilar foydalanuvchi yozuvida saqlanadi, muddati
  cheklanmagan.
- Bot foydalanuvchilari ro'yxati va xabarlar jurnali bazaga yozib boriladi,
  lekin ularni ko'rsatadigan sahifa qo'shilmagan (tugma statistikasi esa
  konstruktorda ko'rinadi).
- Rasm, hujjat va ovozli xabarlar matn tavsifi sifatida saqlanadi; media
  fayllarni yuklab olish qo'shilmagan.
