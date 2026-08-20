import type { AutomationInput } from "@/lib/automation/types";

/**
 * Avtomat shablonlari (§P4.1 PHASE 19).
 *
 * QAT'IY QOIDA: har bir shablon faqat IMPLEMENTED trigger va amallardan
 * tuzilgan. Ishlamaydigan shablon «tayyor» bo'lib ko'rinmasligi kerak —
 * shuning uchun bu yerda `PLANNED_*` ro'yxatidagi hech narsa yo'q.
 *
 * Shablon HAR DOIM qoralama sifatida yaratiladi: foydalanuvchi matnni
 * o'ziga moslab, keyin o'zi nashr qiladi.
 */

export type AutomationTemplate = {
  id: string;
  emoji: string;
  /** Lug'atdagi kalit emas — shablon nomi foydalanuvchi tahrirlaydigan matn. */
  build: (lang: "uz" | "ru" | "en") => AutomationInput;
};

const NAMES = {
  welcome: {
    uz: "Yangi mijozga salomlashish",
    ru: "Приветствие нового клиента",
    en: "Welcome new customer",
  },
  order: {
    uz: "Yangi buyurtma — adminga xabar",
    ru: "Новый заказ — уведомить админа",
    en: "New order — notify admin",
  },
  paid: {
    uz: "To'lov o'tdi — tasdiq",
    ru: "Платёж прошёл — подтверждение",
    en: "Payment successful — confirmation",
  },
  failed: {
    uz: "To'lov o'tmadi — xabar",
    ru: "Платёж не прошёл — сообщение",
    en: "Payment failed — message",
  },
  faq: {
    uz: "«Narx» so'roviga javob",
    ru: "Ответ на слово «цена»",
    en: "Answer the price keyword",
  },
  vip: {
    uz: "Katta buyurtma — VIP tegi",
    ru: "Крупный заказ — тег VIP",
    en: "Large order — VIP tag",
  },
} as const;

const TEXTS = {
  welcome: {
    uz: "Assalomu alaykum! 👋 Botimizga xush kelibsiz.",
    ru: "Здравствуйте! 👋 Добро пожаловать в наш бот.",
    en: "Hello! 👋 Welcome to our bot.",
  },
  order: {
    uz: "Yangi buyurtma tushdi.",
    ru: "Поступил новый заказ.",
    en: "A new order has arrived.",
  },
  paid: {
    uz: "To'lov qabul qilindi. Rahmat! Buyurtmangiz tayyorlanmoqda.",
    ru: "Платёж получен. Спасибо! Заказ готовится.",
    en: "Payment received. Thank you! Your order is being prepared.",
  },
  failed: {
    uz: "To'lov amalga oshmadi. Qaytadan urinib ko'ring yoki biz bilan bog'laning.",
    ru: "Платёж не прошёл. Попробуйте ещё раз или свяжитесь с нами.",
    en: "The payment did not go through. Please try again or contact us.",
  },
  faq: {
    uz: "Narxlar menyuda ko'rsatilgan. Savolingiz bo'lsa yozing.",
    ru: "Цены указаны в меню. Если есть вопрос — напишите.",
    en: "Prices are listed in the menu. Write to us if you have a question.",
  },
} as const;

export const TEMPLATES: AutomationTemplate[] = [
  {
    id: "welcome",
    emoji: "👋",
    build: (lang) => ({
      name: NAMES.welcome[lang],
      trigger: "user_joined",
      triggerConfig: {},
      conditions: { op: "and", rules: [] },
      actions: [
        { type: "send_message", text: TEXTS.welcome[lang] },
        { type: "add_tag", tag: "new_user" },
      ],
    }),
  },
  {
    id: "new_order",
    emoji: "🛒",
    build: (lang) => ({
      name: NAMES.order[lang],
      trigger: "order_created",
      triggerConfig: {},
      conditions: { op: "and", rules: [] },
      actions: [{ type: "notify_admin", text: TEXTS.order[lang] }],
    }),
  },
  {
    id: "payment_ok",
    emoji: "✅",
    build: (lang) => ({
      name: NAMES.paid[lang],
      trigger: "payment_successful",
      triggerConfig: {},
      conditions: { op: "and", rules: [] },
      actions: [{ type: "notify_admin", text: TEXTS.paid[lang] }],
    }),
  },
  {
    id: "payment_failed",
    emoji: "⚠️",
    build: (lang) => ({
      name: NAMES.failed[lang],
      trigger: "payment_failed",
      triggerConfig: {},
      conditions: { op: "and", rules: [] },
      actions: [{ type: "notify_admin", text: TEXTS.failed[lang] }],
    }),
  },
  {
    id: "keyword_faq",
    emoji: "💬",
    build: (lang) => ({
      name: NAMES.faq[lang],
      trigger: "keyword_received",
      triggerConfig: { keyword: lang === "ru" ? "цена" : lang === "en" ? "price" : "narx" },
      conditions: { op: "and", rules: [] },
      actions: [{ type: "send_message", text: TEXTS.faq[lang] }],
    }),
  },
  {
    id: "vip_tag",
    emoji: "⭐",
    build: (lang) => ({
      name: NAMES.vip[lang],
      trigger: "order_created",
      triggerConfig: {},
      conditions: {
        op: "and",
        rules: [{ field: "order.amount", operator: "greater_than", value: 500000 }],
      },
      actions: [{ type: "add_tag", tag: "vip" }],
    }),
  },
];

export function templateById(id: string): AutomationTemplate | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}
