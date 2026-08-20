import type { BusinessKind } from "@/lib/ai/blueprint";

/**
 * Rasmiy Qara botining matnlari va savollari (§5–7, §41).
 *
 * Bu fayl `server-only` emas: savollar ro'yxati sinovlarda ham kerak.
 * Sir yoki server mantig'i yo'q — faqat matn va marshrut kodlari.
 *
 * TAMOYIL (§40): bot forma emas. Har safar FAQAT keyingi zarur savol
 * beriladi va javoblar tugma bilan olinadi — foydalanuvchi yozishga
 * majbur emas, lekin xohlasa yoza oladi.
 */

export type BotLang = "uz" | "ru" | "en";

/* ── Callback kodlari ────────────────────────────────────────────────────── */

/**
 * `callback_data` 64 baytgacha va OCHIQ (§57): unga hech qachon sir,
 * foydalanuvchi id'si yoki shaxsiy ma'lumot qo'yilmaydi. Faqat qisqa
 * marshrut kodi — holat serverda `OnboardingSession` da turadi.
 */
export const CB = {
  onboardStart: "ob:start",
  businessType: (id: string) => `ob:biz:${id}`,
  goal: (id: string) => `ob:goal:${id}`,
  goalsDone: "ob:goals:done",
  channel: (id: string) => `ob:ch:${id}`,
  hasProducts: (yes: boolean) => `ob:prod:${yes ? "y" : "n"}`,
  planBuild: "pl:build",
  planEdit: "pl:edit",
  planCancel: "pl:cancel",
  menu: "nav:menu",
  demo: "nav:demo",
  demoPick: (id: string) => `demo:${id}`,
  createBot: "nav:createbot",
  createStore: "nav:createstore",
  automation: "nav:automation",
  ai: "nav:ai",
} as const;

/* ── Savol variantlari ───────────────────────────────────────────────────── */

/** 1-savol: biznes turi. `kind` — blueprint retseptiga to'g'ridan-to'g'ri mos. */
export const BUSINESS_TYPES: {
  id: string;
  kind: BusinessKind;
  label: Record<BotLang, string>;
}[] = [
  {
    id: "clothing",
    kind: "clothing",
    label: { uz: "👕 Kiyim do'koni", ru: "👕 Магазин одежды", en: "👕 Clothing store" },
  },
  {
    id: "shop",
    kind: "ecommerce",
    label: { uz: "🛍 Onlayn do'kon", ru: "🛍 Интернет-магазин", en: "🛍 Online store" },
  },
  {
    id: "restaurant",
    kind: "restaurant",
    label: { uz: "🍔 Restoran / kafe", ru: "🍔 Ресторан / кафе", en: "🍔 Restaurant / cafe" },
  },
  {
    id: "beauty",
    kind: "beauty",
    label: { uz: "💇 Salon", ru: "💇 Салон", en: "💇 Beauty salon" },
  },
  {
    id: "education",
    kind: "education",
    label: { uz: "🎓 Ta'lim markazi", ru: "🎓 Учебный центр", en: "🎓 Education" },
  },
  {
    id: "service",
    kind: "support",
    label: { uz: "🛠 IT / xizmat", ru: "🛠 IT / услуги", en: "🛠 IT / services" },
  },
  {
    id: "delivery",
    kind: "delivery",
    label: { uz: "📦 Yetkazib berish", ru: "📦 Доставка", en: "📦 Delivery" },
  },
  {
    id: "unknown",
    kind: "other",
    label: { uz: "🤷 Bilmayman, g'oya kerak", ru: "🤷 Не знаю, нужна идея", en: "🤷 Not sure yet" },
  },
];

/** 2-savol: Telegram orqali nima qilmoqchi (bir nechta tanlanadi). */
export const GOALS: { id: string; label: Record<BotLang, string> }[] = [
  { id: "sell", label: { uz: "🛍 Sotish", ru: "🛍 Продавать", en: "🛍 Sell" } },
  {
    id: "customers",
    label: { uz: "📞 Mijozlar bilan ishlash", ru: "📞 Работа с клиентами", en: "📞 Talk to customers" },
  },
  { id: "booking", label: { uz: "📅 Bron qilish", ru: "📅 Бронирование", en: "📅 Bookings" } },
  { id: "support", label: { uz: "🤖 AI support", ru: "🤖 ИИ-поддержка", en: "🤖 AI support" } },
  { id: "orders", label: { uz: "📦 Buyurtma olish", ru: "📦 Принимать заказы", en: "📦 Take orders" } },
  { id: "marketing", label: { uz: "📢 Reklama", ru: "📢 Реклама", en: "📢 Marketing" } },
  {
    id: "automation",
    label: { uz: "⚙️ Avtomatlashtirish", ru: "⚙️ Автоматизация", en: "⚙️ Automation" },
  },
];

/** 3-savol: biznes hozir qayerda ishlaydi. */
export const CHANNELS: { id: string; label: Record<BotLang, string> }[] = [
  { id: "telegram", label: { uz: "Telegram", ru: "Telegram", en: "Telegram" } },
  { id: "instagram", label: { uz: "Instagram", ru: "Instagram", en: "Instagram" } },
  { id: "website", label: { uz: "Vebsayt", ru: "Сайт", en: "Website" } },
  { id: "offline", label: { uz: "Offline", ru: "Офлайн", en: "Offline" } },
  {
    id: "none",
    label: { uz: "Hali boshlamaganman", ru: "Ещё не начал", en: "Not started yet" },
  },
];

/* ── Matnlar ─────────────────────────────────────────────────────────────── */

type Text = Record<BotLang, string>;

export const TEXT: Record<string, Text> = {
  welcome: {
    uz: "Assalomu alaykum 👋\n\nMen Qara — Telegram biznesingizni AI yordamida yaratib beradigan platformaman.\n\nSiz menga nima qilmoqchi ekaningizni aytasiz. Men esa bot, do'kon, AI va avtomatizatsiyani tayyorlab beraman.",
    ru: "Здравствуйте 👋\n\nЯ Qara — платформа, которая с помощью ИИ создаёт ваш бизнес в Telegram.\n\nВы говорите, что хотите сделать. Я готовлю бота, магазин, ИИ и автоматизации.",
    en: "Hello 👋\n\nI'm Qara — the platform that builds your Telegram business with AI.\n\nTell me what you want to build. I'll prepare the bot, store, AI and automations.",
  },
  menuTitle: {
    uz: "Nima qilamiz?",
    ru: "Что делаем?",
    en: "What shall we do?",
  },
  q1: {
    uz: "Qanday biznesingiz bor?",
    ru: "Какой у вас бизнес?",
    en: "What kind of business do you have?",
  },
  q1Free: {
    uz: "Ro'yxatda yo'q bo'lsa — shunchaki yozib yuboring.",
    ru: "Если нет в списке — просто напишите.",
    en: "Not on the list? Just type it.",
  },
  q2: {
    uz: "Telegram orqali nima qilmoqchisiz?\n\nBir nechtasini tanlashingiz mumkin.",
    ru: "Что хотите делать через Telegram?\n\nМожно выбрать несколько.",
    en: "What do you want to do via Telegram?\n\nYou can pick several.",
  },
  q3: {
    uz: "Biznesingiz hozir qayerda ishlaydi?",
    ru: "Где сейчас работает ваш бизнес?",
    en: "Where does your business run today?",
  },
  q4: {
    uz: "Mahsulot yoki xizmatingiz tayyormi?",
    ru: "У вас уже есть товары или услуги?",
    en: "Do you already have products or services?",
  },
  thinking: {
    uz: "Biznesingizni tahlil qilyapman… ✨",
    ru: "Анализирую ваш бизнес… ✨",
    en: "Analysing your business… ✨",
  },
  understood: {
    uz: "Biznesingizni tushundim.",
    ru: "Я понял ваш бизнес.",
    en: "I understood your business.",
  },
  planIntro: {
    uz: "Qara siz uchun quyidagilarni tavsiya qiladi:",
    ru: "Qara рекомендует для вас следующее:",
    en: "Qara recommends the following for you:",
  },
  planAsk: {
    uz: "Shularni yaratamizmi?",
    ru: "Создаём это?",
    en: "Shall we build this?",
  },
  building: {
    uz: "Ish maydoningizni tayyorlayapman…",
    ru: "Готовлю ваше рабочее пространство…",
    en: "Preparing your workspace…",
  },
  ready: {
    uz: "Ish maydoningiz tayyor 🎉\n\nRejani ko'rib chiqish, tahrirlash va botni ishga tushirish uchun Qara'ni oching.",
    ru: "Ваше рабочее пространство готово 🎉\n\nОткройте Qara, чтобы посмотреть план, изменить его и запустить бота.",
    en: "Your workspace is ready 🎉\n\nOpen Qara to review the plan, edit it and launch your bot.",
  },
  openQara: {
    uz: "🚀 Qara'ni ochish",
    ru: "🚀 Открыть Qara",
    en: "🚀 Open Qara",
  },
  cancelled: {
    uz: "Yaxshi, bekor qildim. Xohlagan paytingizda /start bosing.",
    ru: "Хорошо, отменил. Нажмите /start в любой момент.",
    en: "Alright, cancelled. Press /start whenever you like.",
  },
  editHint: {
    uz: "Rejani Qara ichida batafsil tahrirlaysiz — tugmalar, matnlar, AI va hammasini.\n\nAvval ish maydoningizni ochamiz.",
    ru: "План детально редактируется внутри Qara — кнопки, тексты, ИИ и всё остальное.\n\nСначала откроем рабочее пространство.",
    en: "You'll edit the plan in detail inside Qara — buttons, texts, AI and everything else.\n\nLet's open your workspace first.",
  },
  demoIntro: {
    uz: "Qara nimalar qila olishini ko'ring:",
    ru: "Посмотрите, что умеет Qara:",
    en: "See what Qara can do:",
  },
  demoSoon: {
    uz: "Interaktiv demo tayyorlanmoqda. Hozircha o'z biznesingizni yaratib ko'ring — bu 2 daqiqa oladi.",
    ru: "Интерактивное демо готовится. А пока создайте свой бизнес — это займёт 2 минуты.",
    en: "The interactive demo is on its way. Meanwhile, build your own business — it takes 2 minutes.",
  },
  aiSoon: {
    uz: "Qara AI chat tez orada shu yerda ishlaydi. Hozircha Qara ichidagi AI yordamchidan foydalaning.",
    ru: "Чат с Qara AI скоро появится здесь. Пока пользуйтесь ИИ-помощником внутри Qara.",
    en: "Qara AI chat is coming here soon. For now use the AI assistant inside Qara.",
  },
  help: {
    uz: "Qara bot buyruqlari:\n\n/start — boshlash\n/create — yangi biznes yaratish\n/bots — botlarim\n/ai — Qara AI\n/help — yordam\n/settings — sozlamalar",
    ru: "Команды бота Qara:\n\n/start — начать\n/create — создать бизнес\n/bots — мои боты\n/ai — Qara AI\n/help — помощь\n/settings — настройки",
    en: "Qara bot commands:\n\n/start — get started\n/create — create a business\n/bots — my bots\n/ai — Qara AI\n/help — help\n/settings — settings",
  },
  needAccount: {
    uz: "Buning uchun avval ish maydoni kerak. Keling, biznesingizni yaratamiz.",
    ru: "Для этого нужно рабочее пространство. Давайте создадим ваш бизнес.",
    en: "You'll need a workspace first. Let's create your business.",
  },
  notConfigured: {
    uz: "Bot hali to'liq sozlanmagan. Administrator TELEGRAM_BOT_TOKEN ni qo'shishi kerak.",
    ru: "Бот ещё не настроен. Администратору нужно добавить TELEGRAM_BOT_TOKEN.",
    en: "The bot is not fully configured yet. An administrator needs to add TELEGRAM_BOT_TOKEN.",
  },
};

export function say(key: keyof typeof TEXT, lang: BotLang): string {
  return TEXT[key][lang];
}

/** Bosilgan variantlarga belgi qo'yish — ko'p tanlovli savol uchun. */
export function mark(label: string, selected: boolean): string {
  return selected ? `✅ ${label}` : label;
}
