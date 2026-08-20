import type { Blueprint, BusinessKind, FeatureId } from "@/lib/ai/blueprint";

/**
 * Shablon retseptlari (§8) va aqlli standartlar (§51).
 *
 * Bitta katalog ikki vazifani bajaradi:
 *  1. Shablon tanlash oynasi — foydalanuvchi tayyor bot turini tanlaydi.
 *  2. AI ishlamaganda zaxira generator — kalit yo'q bo'lsa ham "Build with AI"
 *     bosilganda haqiqiy, ishlaydigan reja chiqadi (soxta tugma qolmasin).
 *
 * Retsept — to'liq bo'lmagan blueprint: nom va tavsif foydalanuvchi matnidan
 * to'ldiriladi, qolgani shu yerdan keladi.
 */

export type Recipe = {
  id: BusinessKind;
  /// Shablon kartasidagi sarlavha
  title: string;
  emoji: string;
  tagline: string;
  /// Standart bot nomi (foydalanuvchi matnidan nom aniqlanmasa)
  defaultName: string;
  /// Shu turdagi bot uchun yoqiladigan funksiyalar (§51 smart defaults)
  features: FeatureId[];
  build: (ctx: { name: string }) => Omit<
    Blueprint,
    "name" | "description" | "shortDescription" | "businessKind" | "features" | "language"
  >;
};

/* ── Yordamchi qurilmalar ────────────────────────────────────────────────── */

const say = (text: string, emoji: string, reply: string) => ({
  text,
  emoji,
  actionType: "send_message" as const,
  reply,
  children: [],
});

const ask = (text: string, emoji: string) => ({
  text,
  emoji,
  actionType: "ai_chat" as const,
  reply: "",
  children: [],
});

const submenu = (
  text: string,
  emoji: string,
  children: { text: string; emoji: string; actionType: "send_message"; reply: string }[],
) => ({
  text,
  emoji,
  actionType: "submenu" as const,
  reply: "",
  children,
});

const leaf = (text: string, emoji: string, reply: string) => ({
  text,
  emoji,
  actionType: "send_message" as const,
  reply,
});

const collect = (text: string, emoji: string, kind: "collect_phone" | "collect_location") => ({
  text,
  emoji,
  actionType: kind,
  reply: "",
  children: [],
});

const contact = (text = "Operator", emoji = "📞") => ({
  text,
  emoji,
  actionType: "contact_admin" as const,
  reply: "",
  children: [],
});

const startCommand = (name: string, welcome: string) => [
  { command: "start", description: "Botni ishga tushirish", reply: welcome },
  {
    command: "help",
    description: "Yordam",
    reply: `${name} bo'yicha savolingiz bo'lsa — quyidagi menyudan foydalaning yoki shunchaki yozing.`,
  },
];

/* ── Retseptlar ──────────────────────────────────────────────────────────── */

export const RECIPES: Recipe[] = [
  {
    id: "ecommerce",
    title: "Telegram Store",
    emoji: "🛍",
    tagline: "Sell products directly in Telegram",
    defaultName: "Mening do'konim",
    features: [
      "catalog",
      "categories",
      "cart",
      "orders",
      "payments",
      "delivery",
      "promotions",
      "analytics",
    ],
    build: ({ name }) => {
      const welcome = `Assalomu alaykum! 👋\n${name} do'koniga xush kelibsiz. Mahsulotlarni ko'rish uchun menyudan foydalaning.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          submenu("Mahsulotlar", "🛍", [
            leaf("Yangi kelganlar", "🔥", "Yangi kelgan mahsulotlar ro'yxati."),
            leaf("Chegirmalar", "🏷", "Joriy chegirmalar."),
            leaf("Hammasi", "📦", "Barcha mahsulotlar katalogi."),
          ]),
          say("Savat", "🛒", "Savatingiz hozircha bo'sh."),
          say("Buyurtmalarim", "📦", "Buyurtmalaringiz shu yerda ko'rinadi."),
          ask("AI yordamchi", "🤖"),
          collect("Telefon qoldirish", "📱", "collect_phone"),
          contact(),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} onlayn do'konining yordamchisisiz. Mahsulotlar, narxlar, yetkazib berish va buyurtma bo'yicha savollarga qisqa va aniq javob bering. Narxni bilmasangiz taxmin qilmang — operatorga yo'naltiring.`,
          personality: "friendly",
          webSearch: false,
          knowledgeBase: true,
        },
        integrations: ["payme", "click"],
        automations: [
          {
            name: "Yangi buyurtma bildirishnomasi",
            trigger: "on_order",
            description: "Buyurtma tushganda adminga Telegram orqali xabar yuboriladi.",
          },
        ],
      };
    },
  },
  {
    id: "restaurant",
    title: "Restaurant",
    emoji: "🍔",
    tagline: "Menu, orders and delivery",
    defaultName: "Mening restoranim",
    features: [
      "digital_menu",
      "categories",
      "cart",
      "orders",
      "delivery",
      "payments",
      "location",
      "promotions",
      "support",
    ],
    build: ({ name }) => {
      const welcome = `Assalomu alaykum! 👋\n${name} ga xush kelibsiz. Menyuni ko'rish uchun quyidagi tugmadan foydalaning.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          submenu("Menyu", "📋", [
            leaf("Issiq taomlar", "🍲", "Issiq taomlar ro'yxati va narxlari."),
            leaf("Fast food", "🍔", "Burger, lavash, hot-dog."),
            leaf("Ichimliklar", "🥤", "Choy, kofe, sharbat, gazli suv."),
            leaf("Shirinliklar", "🍰", "Tort, muzqaymoq, pirojniy."),
          ]),
          say("Savat", "🛒", "Savatingiz hozircha bo'sh."),
          say("Buyurtmalarim", "📦", "Buyurtmalaringiz shu yerda ko'rinadi."),
          collect("Manzil yuborish", "📍", "collect_location"),
          ask("AI ofitsiant", "🤖"),
          contact(),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} restoranining AI ofitsiantisiz. Taomlar tarkibi, allergenlar, narx va yetkazib berish bo'yicha savollarga javob bering. Buyurtmani tasdiqlashda mijozdan manzil va telefon so'rang.`,
          personality: "friendly",
          webSearch: false,
          knowledgeBase: true,
        },
        integrations: ["payme", "click"],
        automations: [
          {
            name: "Yangi buyurtma bildirishnomasi",
            trigger: "on_order",
            description: "Buyurtma tushganda oshxona va adminga xabar boradi.",
          },
        ],
      };
    },
  },
  {
    id: "clothing",
    title: "Clothing Store",
    emoji: "👕",
    tagline: "Sizes, colors, cart and delivery",
    defaultName: "Mening kiyim do'konim",
    features: [
      "catalog",
      "categories",
      "cart",
      "orders",
      "delivery",
      "payments",
      "promotions",
      "crm",
    ],
    build: ({ name }) => {
      const welcome = `Assalomu alaykum! 👋\n${name} ga xush kelibsiz. Kolleksiyani ko'rish uchun menyudan foydalaning.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          submenu("Mahsulotlar", "🛍", [
            leaf("Erkaklar", "👔", "Erkaklar kiyimi kolleksiyasi."),
            leaf("Ayollar", "👗", "Ayollar kiyimi kolleksiyasi."),
            leaf("Bolalar", "🧒", "Bolalar kiyimi kolleksiyasi."),
          ]),
          say("Yangi kelganlar", "🔥", "Yangi kolleksiya."),
          say("Chegirmalar", "🏷", "Joriy chegirmalar va aksiyalar."),
          say("Savat", "🛒", "Savatingiz hozircha bo'sh."),
          say("Buyurtmalarim", "📦", "Buyurtmalaringiz shu yerda ko'rinadi."),
          ask("AI yordamchi", "🤖"),
          contact(),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} kiyim do'konining yordamchisisiz. O'lcham tanlash, mato tarkibi, ranglar va yetkazib berish bo'yicha maslahat bering. O'lcham jadvalini aniq bilmasangiz — operatorga yo'naltiring.`,
          personality: "friendly",
          webSearch: false,
          knowledgeBase: true,
        },
        integrations: ["payme", "click"],
        automations: [
          {
            name: "Yangi buyurtma bildirishnomasi",
            trigger: "on_order",
            description: "Buyurtma tushganda adminga xabar yuboriladi.",
          },
        ],
      };
    },
  },
  {
    id: "beauty",
    title: "Beauty Salon",
    emoji: "💇",
    tagline: "Services, staff, booking and reminders",
    defaultName: "Mening salonim",
    features: ["booking", "staff", "reminders", "crm", "location", "support"],
    build: ({ name }) => {
      const welcome = `Assalomu alaykum! 👋\n${name} ga xush kelibsiz. Navbatga yozilish uchun menyudan foydalaning.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          submenu("Xizmatlar", "💇", [
            leaf("Soch turmagi", "✂️", "Soch turmagi xizmatlari va narxlari."),
            leaf("Manikyur", "💅", "Manikyur va pedikyur xizmatlari."),
            leaf("Kosmetologiya", "🧴", "Yuz parvarishi xizmatlari."),
          ]),
          say("Ustalar", "👩‍💼", "Ustalarimiz va ish vaqtlari."),
          say("Navbatga yozilish", "📅", "Qulay sana va vaqtni yozing — tasdiqlaymiz."),
          say("Mening bronlarim", "📋", "Faol bronlaringiz shu yerda ko'rinadi."),
          collect("Telefon qoldirish", "📱", "collect_phone"),
          collect("Manzil", "📍", "collect_location"),
          contact(),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} go'zallik salonining administratorisiz. Xizmatlar, narxlar, davomiylik va bo'sh vaqtlar bo'yicha javob bering. Bron qilishda mijozdan ism, telefon va qulay vaqtni so'rang.`,
          personality: "friendly",
          webSearch: false,
          knowledgeBase: true,
        },
        integrations: ["sms"],
        automations: [
          {
            name: "Bron tasdiqlash",
            trigger: "on_order",
            description: "Bron yaratilganda mijozga tasdiq xabari yuboriladi.",
          },
          {
            name: "24 soat oldin eslatma",
            trigger: "schedule",
            description: "Bron vaqtidan 24 soat oldin mijozga eslatma boradi.",
          },
        ],
      };
    },
  },
  {
    id: "education",
    title: "Education",
    emoji: "🎓",
    tagline: "Courses, tests and an AI tutor",
    defaultName: "Mening o'quv markazim",
    features: [
      "courses",
      "tests",
      "progress",
      "certificates",
      "ai_assistant",
      "knowledge_base",
    ],
    build: ({ name }) => {
      const welcome = `Assalomu alaykum! 👋\n${name} ga xush kelibsiz. Kurslarni ko'rish uchun menyudan foydalaning.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          submenu("Kurslar", "📚", [
            leaf("Boshlang'ich", "🌱", "Boshlang'ich daraja kurslari."),
            leaf("O'rta", "📗", "O'rta daraja kurslari."),
            leaf("Yuqori", "🎓", "Yuqori daraja kurslari."),
          ]),
          say("Testlar", "📝", "Test topshirish uchun kursni tanlang."),
          ask("AI o'qituvchi", "🤖"),
          say("Natijalarim", "📊", "Natijalaringiz shu yerda ko'rinadi."),
          say("Sertifikatlar", "🏆", "Olgan sertifikatlaringiz."),
          contact("Aloqa", "📞"),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} o'quv markazining AI o'qituvchisisiz. Mavzuni sodda tilda tushuntiring, misollar keltiring va o'quvchiga savol berib bilimini tekshiring. Javobni tayyor holda bermang — avval o'ylashga undang.`,
          personality: "friendly",
          webSearch: true,
          knowledgeBase: true,
        },
        integrations: [],
        automations: [
          {
            name: "Kunlik dars",
            trigger: "schedule",
            description: "Har kuni belgilangan vaqtda yangi dars yuboriladi.",
          },
        ],
      };
    },
  },
  {
    id: "support",
    title: "Customer Support",
    emoji: "🎧",
    tagline: "FAQ, AI support and human handoff",
    defaultName: "Qo'llab-quvvatlash",
    features: [
      "support",
      "ai_assistant",
      "knowledge_base",
      "human_handoff",
      "crm",
    ],
    build: ({ name }) => {
      const welcome = `Assalomu alaykum! 👋\n${name} qo'llab-quvvatlash xizmatiga xush kelibsiz. Savolingizni yozing — javob beramiz.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          ask("AI yordamchi", "🤖"),
          submenu("Ko'p so'raladigan savollar", "📋", [
            leaf("Yetkazib berish", "🚚", "Yetkazib berish 1–3 kun ichida amalga oshiriladi."),
            leaf("To'lov", "💳", "Naqd, karta va onlayn to'lov qabul qilinadi."),
            leaf("Qaytarish", "↩️", "14 kun ichida mahsulotni qaytarish mumkin."),
          ]),
          say("Murojaat yuborish", "🎫", "Murojaatingizni matn ko'rinishida yozing."),
          contact("Operatorga ulanish", "🙋"),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} qo'llab-quvvatlash xizmatining yordamchisisiz. Aniq va xushmuomala javob bering. Javobni bilmasangiz yoki masala shaxsiy ma'lumot talab qilsa — "Sizni operatorga ulayman" deb operatorga yo'naltiring.`,
          personality: "professional",
          webSearch: false,
          knowledgeBase: true,
        },
        integrations: [],
        automations: [
          {
            name: "Operatorga uzatish",
            trigger: "on_keyword",
            description: "«operator» so'zi yozilganda murojaat operatorga yo'naltiriladi.",
          },
        ],
      };
    },
  },
  {
    id: "delivery",
    title: "Delivery",
    emoji: "📦",
    tagline: "Orders, tracking and status updates",
    defaultName: "Yetkazib berish xizmati",
    features: ["orders", "tracking", "delivery", "location", "support", "analytics"],
    build: ({ name }) => {
      const welcome = `Assalomu alaykum! 👋\n${name} xizmatiga xush kelibsiz. Buyurtmangizni kuzatish uchun raqamini yuboring.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          say("Buyurtmani kuzatish", "📍", "Buyurtma raqamingizni yuboring."),
          say("Yangi buyurtma", "📦", "Yetkazib berish uchun manzil va telefon qoldiring."),
          collect("Manzil yuborish", "🗺", "collect_location"),
          collect("Telefon qoldirish", "📱", "collect_phone"),
          say("Narxlar", "💰", "Yetkazib berish narxi masofaga qarab hisoblanadi."),
          contact(),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} yetkazib berish xizmatining yordamchisisiz. Buyurtma holati, narx va muddat bo'yicha javob bering. Buyurtma raqamini bilmasangiz mijozdan so'rang.`,
          personality: "concise",
          webSearch: false,
          knowledgeBase: false,
        },
        integrations: ["rest_api"],
        automations: [
          {
            name: "Holat o'zgarishi",
            trigger: "on_order",
            description: "Buyurtma holati o'zgarganda mijozga xabar yuboriladi.",
          },
        ],
      };
    },
  },
  {
    id: "ai_assistant",
    title: "AI Assistant",
    emoji: "🤖",
    tagline: "Chat, web search and knowledge base",
    defaultName: "AI yordamchi",
    features: ["ai_assistant", "knowledge_base", "web_search", "analytics"],
    build: ({ name }) => {
      const welcome = `Salom! 👋\nMen — ${name}. Savolingizni yozing, javob topishga harakat qilaman.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          ask("Savol berish", "🤖"),
          {
            text: "Internetdan qidirish",
            emoji: "🔎",
            actionType: "web_search" as const,
            reply: "",
            children: [],
          },
          say("Nima qila olaman?", "💡", "Savol bering, matn yozing yoki hujjat bo'yicha so'rang."),
          {
            text: "Tilni o'zgartirish",
            emoji: "🌐",
            actionType: "change_language" as const,
            reply: "",
            children: [],
          },
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} — foydali va aniq AI yordamchisiz. Qisqa, tushunarli javob bering. Bilmagan narsangizni to'qib chiqarmang; kerak bo'lsa qidiruv vositasidan foydalaning.`,
          personality: "friendly",
          webSearch: true,
          knowledgeBase: true,
        },
        integrations: [],
        automations: [],
      };
    },
  },
  {
    id: "booking",
    title: "Booking",
    emoji: "📅",
    tagline: "Services, calendar and reminders",
    defaultName: "Bron xizmati",
    features: ["booking", "reminders", "crm", "location", "support"],
    build: ({ name }) => {
      const welcome = `Assalomu alaykum! 👋\n${name} ga xush kelibsiz. Bron qilish uchun menyudan foydalaning.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          say("Xizmatlar", "📋", "Xizmatlar ro'yxati va narxlari."),
          say("Bron qilish", "📅", "Qulay sana va vaqtni yozing."),
          say("Mening bronlarim", "🗓", "Faol bronlaringiz shu yerda ko'rinadi."),
          collect("Telefon qoldirish", "📱", "collect_phone"),
          collect("Manzil", "📍", "collect_location"),
          contact(),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} bron xizmatining administratorisiz. Bo'sh vaqtlar, narxlar va shartlar bo'yicha javob bering. Bron qilishda ism, telefon va vaqtni so'rang.`,
          personality: "professional",
          webSearch: false,
          knowledgeBase: true,
        },
        integrations: ["sms"],
        automations: [
          {
            name: "Eslatma",
            trigger: "schedule",
            description: "Bron vaqtidan oldin mijozga eslatma yuboriladi.",
          },
        ],
      };
    },
  },
  {
    id: "other",
    title: "Custom",
    emoji: "⚙️",
    tagline: "Build anything from a blank menu",
    defaultName: "Mening botim",
    features: ["ai_assistant", "support"],
    build: ({ name }) => {
      const welcome = `Salom! 👋\nMen — ${name}. Menyudan foydalaning yoki shunchaki yozing.`;
      return {
        welcomeMessage: welcome,
        commands: startCommand(name, welcome),
        menu: [
          ask("AI yordamchi", "🤖"),
          say("Biz haqimizda", "ℹ️", "Bu yerga o'zingiz haqingizda ma'lumot yozing."),
          contact("Aloqa", "📞"),
        ],
        ai: {
          enabled: true,
          systemPrompt: `Siz ${name} botining yordamchisisiz. Foydalanuvchi savollariga xushmuomala va aniq javob bering.`,
          personality: "friendly",
          webSearch: false,
          knowledgeBase: false,
        },
        integrations: [],
        automations: [],
      };
    },
  },
];

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

/* ── Kalit so'z bo'yicha aniqlash ────────────────────────────────────────── */

const KEYWORDS: Record<BusinessKind, string[]> = {
  restaurant: [
    "restoran", "kafe", "taom", "ovqat", "menyu", "pitsa", "burger", "oshxona",
    "restaurant", "cafe", "food", "pizza", "kitchen", "ресторан", "кафе", "еда",
  ],
  clothing: [
    "kiyim", "ko'ylak", "koylak", "shim", "moda", "brend", "o'lcham", "olcham",
    "clothing", "clothes", "fashion", "apparel", "одежда", "мода",
  ],
  ecommerce: [
    "do'kon", "dokon", "magazin", "mahsulot", "savdo", "tovar", "katalog",
    "shop", "store", "product", "ecommerce", "магазин", "товар", "продукт",
  ],
  beauty: [
    "salon", "sartarosh", "go'zallik", "gozallik", "manikyur", "kosmetolog",
    "beauty", "barber", "hair", "nails", "салон", "красот", "парикмахер",
  ],
  education: [
    "ta'lim", "talim", "kurs", "o'quv", "oquv", "maktab", "dars", "test",
    "o'qituvchi", "ingliz", "education", "course", "school", "learn", "tutor",
    "english", "курс", "школа", "обучен",
  ],
  support: [
    "yordam", "qo'llab", "qollab", "operator", "murojaat", "faq", "shikoyat",
    "support", "helpdesk", "ticket", "поддержк", "помощ",
  ],
  delivery: [
    "yetkaz", "dostavka", "kuryer", "kuzat", "delivery", "courier", "tracking",
    "доставк", "курьер",
  ],
  booking: [
    "bron", "navbat", "band qilish", "booking", "appointment", "reserve",
    "schedule", "бронир", "запис",
  ],
  ai_assistant: [
    "ai", "sun'iy", "suniy", "chatbot", "assistant", "yordamchi", "gpt",
    "ии", "ассистент", "бот-помощник",
  ],
  other: [],
};

/**
 * Erkin matndan biznes turini aniqlaydi.
 *
 * Bu — til modeli emas, sanoqqa asoslangan qidiruv. AI mavjud bo'lmaganda
 * ham foydalanuvchi mazmunli natija oladi.
 */
export function detectKind(prompt: string): BusinessKind {
  const haystack = prompt.toLowerCase();

  let best: { kind: BusinessKind; hits: number } | null = null;
  for (const [kind, words] of Object.entries(KEYWORDS) as [BusinessKind, string[]][]) {
    const hits = words.filter((word) => haystack.includes(word)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { kind, hits };
  }
  return best?.kind ?? "other";
}

/**
 * Matndan bot nomini ajratib olishga urinish: tirnoq ichidagi qism yoki
 * «... uchun bot» qolipidagi ot. Topilmasa retseptning standart nomi.
 */
export function detectName(prompt: string, fallback: string): string {
  const quoted = prompt.match(/["“”'«]([^"“”'»]{2,40})["“”'»]/);
  if (quoted) return quoted[1].trim();
  return fallback;
}
