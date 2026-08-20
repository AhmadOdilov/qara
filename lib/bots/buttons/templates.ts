import type { ActionType, ButtonType, KeyboardKind } from "@/lib/bots/buttons/types";

/**
 * Tayyor menyu shablonlari va takliflar.
 *
 * MUHIM: bu qoidaga asoslangan generator, til modeli emas. Kategoriya yoki
 * tavsifdagi kalit so'zlar bo'yicha mos shablon tanlanadi. AI qatlami
 * qurilgach shu yerga haqiqiy model ulanadi va interfeys o'zgarmaydi —
 * shuning uchun natija `source` maydoni bilan qaytadi.
 */

export type ButtonSeed = {
  text: string;
  emoji?: string;
  actionType: ActionType;
  buttonType?: ButtonType;
  keyboardKind?: KeyboardKind;
  /// Amal sozlamasi — asosan `send_message` uchun javob matni
  config?: Record<string, unknown>;
  /**
   * Qaysi qatorga tushadi (0 dan). Berilmasa har bir tugma o'z qatorini
   * oladi.
   *
   * Ildiz menyusining joylashuvini boshqa yo'l bilan belgilab bo'lmaydi:
   * `layout` sozlamasi menyu tuguniga tegishli, ildizda esa tugun yo'q.
   * Shu sababli shablonlar ildizdagi juftlashtirishni shu maydon bilan
   * beradi (§4, §18).
   */
  row?: number;
  children?: ButtonSeed[];
};

export type Template = {
  id: string;
  name: string;
  description: string;
  /**
   * Ildizdagi klaviatura turi (§4).
   *
   * Ichma-ich shablonlar inline ishlaydi: bitta xabar tahrirlanib boradi,
   * chat yangi xabarlar bilan to'lib ketmaydi. Berilmasa reply klaviatura —
   * eski shablonlarning xatti-harakati o'zgarmaydi.
   */
  keyboard?: KeyboardKind;
  buttons: ButtonSeed[];
};

const reply = (text: string, emoji: string, replyText: string): ButtonSeed => ({
  text,
  emoji,
  actionType: "send_message",
  config: { text: replyText },
});

const menu = (text: string, emoji: string, children: ButtonSeed[]): ButtonSeed => ({
  text,
  emoji,
  actionType: "submenu",
  buttonType: "submenu",
  children,
});

/* ── Ichma-ich inline shablonlar uchun qisqartmalar ──────────────────────── */

/**
 * Inline menyu tuguni.
 *
 * `keyboardKind: "inline"` faqat ildizda ko'rsatiladi — ichkilari meros
 * oladi. `layout` qatordagi tugma sonini belgilaydi, `showHome` esa «🏠 Bosh
 * menyu» tugmasini majburan qo'shadi.
 */
const node = (
  emoji: string,
  text: string,
  options: {
    title?: string;
    description?: string;
    layout?: number;
    showHome?: boolean;
    root?: boolean;
    category?: boolean;
    row?: number;
  },
  children: ButtonSeed[],
): ButtonSeed => ({
  text,
  emoji,
  actionType: options.category ? "category" : "submenu",
  buttonType: "submenu",
  ...(options.root ? { keyboardKind: "inline" as KeyboardKind } : {}),
  ...(options.row === undefined ? {} : { row: options.row }),
  config: {
    ...(options.title ? { title: options.title } : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(options.layout ? { layout: options.layout } : {}),
    ...(options.showHome ? { showHome: true } : {}),
  },
  children,
});

/** Mahsulot kartasi (§9). */
const item = (
  emoji: string,
  text: string,
  price: number,
  description?: string,
): ButtonSeed => ({
  text,
  emoji,
  actionType: "product",
  buttonType: "callback",
  config: {
    price,
    currency: "UZS",
    buyNow: true,
    ...(description ? { description } : {}),
  },
});

const action = (
  emoji: string,
  text: string,
  actionType: ActionType,
  config?: Record<string, unknown>,
  row?: number,
): ButtonSeed => ({
  text,
  emoji,
  actionType,
  buttonType: "callback",
  ...(config ? { config } : {}),
  ...(row === undefined ? {} : { row }),
});

/** Do'kon shabloni uchun qisqa yordam matni (§13 — texnik atama yo'q). */
const HELP_TEXT = [
  "🛍 Mahsulotlar — katalogni ko'rish",
  "🛒 Savatcha — tanlaganlaringiz va buyurtma berish",
  "📦 Buyurtmalarim — buyurtma holati",
  "❤️ Sevimlilar — saqlangan mahsulotlar",
  "",
  "Savol bo'lsa — ☎️ Aloqa bo'limiga yozing.",
].join("\n");

const say = (emoji: string, text: string, replyText: string): ButtonSeed =>
  action(emoji, text, "send_message", { text: replyText });

export const TEMPLATES: Template[] = [
  {
    id: "shop",
    keyboard: "inline",
    name: "Do'kon (ichma-ich menyu)",
    description:
      "Kategoriya → ichki kategoriya → mahsulot → savat → buyurtma. To'liq inline navigatsiya",
    buttons: [
      node(
        "🛍",
        "Mahsulotlar",
        {
          root: true,
          row: 0,
          title: "📂 Kategoriyalar",
          description: "Kerakli kategoriyani tanlang.",
          layout: 2,
        },
        [
          node(
            "👕",
            "Kiyimlar",
            { title: "👕 Kiyimlar", description: "Bo'limni tanlang.", layout: 2 },
            [
              node("👕", "Erkaklar", { title: "👕 Erkaklar kiyimlari", layout: 1, category: true }, [
                item("👔", "Ko'ylak", 250000, "Paxta, klassik bichim."),
                item("👖", "Shim", 320000, "Kundalik kiyim uchun."),
              ]),
              node("👗", "Ayollar", { title: "👗 Ayollar kiyimlari", layout: 1, category: true }, [
                item("👗", "Ko'ylak", 420000, "Yozgi kolleksiya."),
                item("👜", "Sumka", 550000, "Tabiiy teri."),
              ]),
            ],
          ),
          node(
            "📱",
            "Elektronika",
            { title: "📱 Elektronika", layout: 1, showHome: true, category: true },
            [
              item("🍎", "iPhone 15 Pro", 12500000, "256 GB, Titanium."),
              item("📱", "Samsung S24", 9800000, "256 GB."),
              item("📱", "Xiaomi 14", 6500000, "512 GB."),
              item("💻", "MacBook Air", 15900000, "M3, 16 GB RAM."),
            ],
          ),
          node("🔥", "Chegirmalar", { title: "🔥 Chegirmalar", layout: 1, category: true }, [
            item("🎧", "Simsiz quloqchin", 450000, "Chegirma: -30%"),
            item("⌚️", "Smart soat", 890000, "Chegirma: -20%"),
          ]),
        ],
      ),
      // Ildizdagi joylashuv (§4, §18): birinchi qatorda katalog — asosiy
      // amal, keyin juft-juft qilib qolgan bo'limlar. Mobil ekranda uzun
      // ustun emas, ixcham panel chiqadi.
      action("🛒", "Savatcha", "view_cart", undefined, 1),
      action("📦", "Buyurtmalarim", "my_orders", undefined, 1),
      action("❤️", "Sevimlilar", "favorites", undefined, 2),
      action("👤", "Profil", "profile", undefined, 2),
      action("ℹ️", "Yordam", "help", { text: HELP_TEXT }, 3),
      action(
        "☎️",
        "Aloqa",
        "contact_admin",
        { text: "Savollar uchun: @admin\nTelefon: +998 90 000 00 00" },
        3,
      ),
    ],
  },
  {
    id: "restaurant_menu",
    keyboard: "inline",
    name: "Restoran (ichma-ich menyu)",
    description: "Menyu → taom turi → taom kartasi → savat → buyurtma",
    buttons: [
      node(
        "🍔",
        "Menyu",
        {
          root: true,
          title: "🍔 Bizning menyu",
          description: "Bo'limni tanlang.",
          layout: 2,
        },
        [
          node("🍕", "Pitsa", { title: "🍕 Pitsalar", layout: 1, category: true }, [
            item("🍕", "Margarita", 65000, "Pishloq va pomidor."),
            item("🍕", "Pepperoni", 85000, "Achchiq kolbasa."),
            item("🍕", "To'rt pishloq", 95000, "To'rt xil pishloq."),
          ]),
          node("🍔", "Burgerlar", { title: "🍔 Burgerlar", layout: 1, category: true }, [
            item("🍔", "Klassik", 45000),
            item("🧀", "Cheeseburger", 55000),
            item("🍔", "Double", 75000),
          ]),
          node("🥤", "Ichimliklar", { title: "🥤 Ichimliklar", layout: 2, category: true }, [
            item("🥤", "Kola", 12000),
            item("☕️", "Kofe", 18000),
            item("🍹", "Sharbat", 15000),
            item("💧", "Suv", 6000),
          ]),
        ],
      ),
      action("🛒", "Savatcha", "view_cart"),
      action("📦", "Buyurtmalarim", "my_orders"),
      action("📍", "Manzil", "collect_location", {
        text: "Yetkazib berish uchun joylashuvingizni yuboring.",
      }),
      action("☎️", "Aloqa", "contact_admin", {
        text: "Telefon: +998 90 000 00 00\nIsh vaqti: 09:00–23:00",
      }),
    ],
  },
  {
    id: "service_menu",
    keyboard: "inline",
    name: "Xizmat (ichma-ich menyu)",
    description: "Xizmatlar → yo'nalish → narxlar, bron va aloqa",
    buttons: [
      node(
        "🛠",
        "Xizmatlar",
        {
          root: true,
          title: "🛠 Xizmatlarimiz",
          description: "Kerakli yo'nalishni tanlang.",
          layout: 1,
        },
        [
          node("💻", "Veb-saytlar", { title: "💻 Veb-saytlar", layout: 1, category: true }, [
            say("🏢", "Korporativ sayt", "Korporativ sayt: 7 kundan boshlab."),
            say("🛍", "Onlayn do'kon", "Onlayn do'kon: to'lov va yetkazib berish bilan."),
          ]),
          node("📱", "Mobil ilovalar", { title: "📱 Mobil ilovalar", layout: 1, category: true }, [
            say("🤖", "Android", "Android ilova ishlab chiqish."),
            say("🍎", "iOS", "iOS ilova ishlab chiqish."),
          ]),
        ],
      ),
      say("💰", "Narxlar", "Narxlar loyiha hajmiga qarab belgilanadi."),
      action("📅", "Bron qilish", "collect_phone", {
        text: "Qo'ng'iroq qilishimiz uchun raqamingizni qoldiring.",
      }),
      action("📍", "Manzil", "collect_location"),
      action("☎️", "Aloqa", "contact_admin"),
    ],
  },
  {
    id: "community_menu",
    keyboard: "inline",
    name: "Hamjamiyat (ichma-ich menyu)",
    description: "Yangiliklar, materiallar va profil — inline navigatsiya bilan",
    buttons: [
      node(
        "📢",
        "Yangiliklar",
        {
          root: true,
          title: "📢 Yangiliklar",
          description: "Rukanni tanlang.",
          layout: 2,
        },
        [
          say("📣", "E'lonlar", "Yangi e'lonlar shu yerda chiqadi."),
          say("📅", "Tadbirlar", "Yaqin tadbirlar ro'yxati."),
        ],
      ),
      node(
        "📚",
        "Materiallar",
        { title: "📚 Materiallar", layout: 1 },
        [
          say("📖", "Boshlovchilar uchun", "Boshlang'ich materiallar to'plami."),
          say("🎓", "Ilg'orlar uchun", "Chuqurlashtirilgan materiallar."),
        ],
      ),
      say("👥", "Guruh", "Guruhimizga qo'shilish uchun adminga yozing."),
      action("👤", "Profil", "profile"),
    ],
  },
  {
    id: "restaurant",
    name: "Restoran",
    description: "Menyu, buyurtma, yetkazib berish va aloqa",
    buttons: [
      menu("Menyu", "🍔", [
        reply("Pitsa", "🍕", "Pitsalarimiz: Margarita, Pepperoni, To'rt pishloq."),
        reply("Burgerlar", "🍔", "Burgerlar: Klassik, Cheeseburger, Double."),
        reply("Ichimliklar", "🥤", "Ichimliklar: choy, kofe, sharbatlar, gazli suv."),
        reply("Shirinliklar", "🍰", "Shirinliklar: cheesecake, tiramisu, muzqaymoq."),
      ]),
      reply("Buyurtma", "🛒", "Buyurtma berish uchun tanlagan taomingiz nomini yozing."),
      { text: "Buyurtmalarim", emoji: "📦", actionType: "my_orders" },
      { text: "Manzil", emoji: "📍", actionType: "collect_location" },
      reply("Aloqa", "☎️", "Telefon: +998 90 000 00 00\nIsh vaqti: 09:00–23:00"),
    ],
  },
  {
    id: "ecommerce",
    name: "Onlayn do'kon",
    description: "Mahsulotlar, savat, buyurtmalar va aksiyalar",
    buttons: [
      menu("Mahsulotlar", "🛍", [
        reply("Kiyim", "👕", "Kiyim bo'limi: ko'ylak, shim, kurtka."),
        reply("Oyoq kiyim", "👟", "Oyoq kiyim: krossovka, tufli, botinka."),
        reply("Aksessuarlar", "🎒", "Aksessuarlar: sumka, soat, kamar."),
      ]),
      reply("Qidiruv", "🔎", "Qidirmoqchi bo'lgan mahsulot nomini yozing."),
      { text: "Savatcha", emoji: "🛒", actionType: "view_cart" },
      { text: "Buyurtmalarim", emoji: "📦", actionType: "my_orders" },
      reply("Aksiyalar", "🎁", "Joriy aksiyalar haqida tez orada xabar beramiz."),
    ],
  },
  {
    id: "education",
    name: "Ta'lim",
    description: "Kurslar, testlar, natijalar va yordam",
    buttons: [
      menu("Kurslar", "📚", [
        reply("Boshlang'ich", "🌱", "Boshlang'ich darajadagi kurslar ro'yxati."),
        reply("O'rta", "📗", "O'rta darajadagi kurslar ro'yxati."),
        reply("Yuqori", "🎓", "Yuqori darajadagi kurslar ro'yxati."),
      ]),
      reply("Testlar", "📝", "Test topshirish uchun kursni tanlang."),
      { text: "AI o'qituvchi", emoji: "🤖", actionType: "ai_chat" },
      reply("Natijalarim", "📊", "Natijalaringiz shu yerda ko'rinadi."),
      reply("Yordam", "📞", "Savollaringiz bo'lsa yozing — javob beramiz."),
    ],
  },
  {
    id: "support",
    name: "Qo'llab-quvvatlash",
    description: "FAQ, murojaat va operator bilan aloqa",
    buttons: [
      { text: "AI yordamchi", emoji: "🤖", actionType: "ai_chat" },
      menu("Ko'p so'raladigan savollar", "📋", [
        reply("Yetkazib berish", "🚚", "Yetkazib berish 1–3 kun ichida amalga oshiriladi."),
        reply("To'lov", "💳", "Naqd, karta va onlayn to'lov qabul qilinadi."),
        reply("Qaytarish", "↩️", "14 kun ichida mahsulotni qaytarish mumkin."),
      ]),
      reply("Murojaat yuborish", "🎫", "Murojaatingizni matn ko'rinishida yozing."),
      { text: "Operator bilan bog'lanish", emoji: "📞", actionType: "contact_admin" },
    ],
  },
  {
    id: "booking",
    name: "Bron qilish",
    description: "Xizmatlar, vaqt tanlash va bronlar",
    buttons: [
      reply("Xizmatlar", "💇", "Xizmatlar ro'yxati va narxlari."),
      reply("Bron qilish", "🗓", "Bron uchun qulay sana va vaqtni yozing."),
      reply("Mening bronlarim", "📋", "Faol bronlaringiz shu yerda ko'rinadi."),
      { text: "Manzil", emoji: "📍", actionType: "collect_location" },
      { text: "Telefon qoldirish", emoji: "📱", actionType: "collect_phone" },
    ],
  },
  {
    id: "delivery",
    name: "Yetkazib berish",
    description: "Buyurtma kuzatuvi va manzil",
    buttons: [
      reply("Buyurtmani kuzatish", "🚚", "Buyurtma raqamingizni yuboring."),
      { text: "Manzilni yuborish", emoji: "📍", actionType: "collect_location" },
      { text: "Telefon raqam", emoji: "📱", actionType: "collect_phone" },
      reply("Narxlar", "💰", "Yetkazib berish narxi masofaga qarab hisoblanadi."),
      { text: "Operator", emoji: "☎️", actionType: "contact_admin" },
    ],
  },
  {
    id: "news",
    name: "Yangiliklar",
    description: "Rukanlar va obuna",
    buttons: [
      menu("Rukanlar", "🗞", [
        reply("Iqtisod", "💹", "Iqtisod yangiliklari."),
        reply("Sport", "⚽️", "Sport yangiliklari."),
        reply("Texnologiya", "💻", "Texnologiya yangiliklari."),
      ]),
      { text: "Qidiruv", emoji: "🔎", actionType: "web_search" },
      reply("Obuna bo'lish", "🔔", "Yangiliklarga obuna bo'ldingiz."),
      reply("Obunani bekor qilish", "🔕", "Obuna bekor qilindi."),
    ],
  },
  {
    id: "ai_assistant",
    name: "AI yordamchi",
    description: "Savol-javob, qidiruv va sozlamalar",
    buttons: [
      { text: "Savol berish", emoji: "🤖", actionType: "ai_chat" },
      { text: "Internetdan qidirish", emoji: "🔎", actionType: "web_search" },
      reply("Nima qila olaman?", "💡", "Savol bering — javob topishga harakat qilaman."),
      { text: "Tilni o'zgartirish", emoji: "🌐", actionType: "change_language" },
    ],
  },
  {
    id: "personal",
    name: "Shaxsiy yordamchi",
    description: "Eslatmalar, profil va sozlamalar",
    buttons: [
      reply("Eslatmalarim", "📝", "Eslatmalaringiz shu yerda saqlanadi."),
      { text: "Ismni kiritish", emoji: "👤", actionType: "collect_name" },
      { text: "Email qoldirish", emoji: "✉️", actionType: "collect_email" },
      { text: "Til", emoji: "🌐", actionType: "change_language" },
    ],
  },
  {
    id: "community",
    name: "Hamjamiyat",
    description: "Qoidalar, havolalar va aloqa",
    buttons: [
      reply("Qoidalar", "📜", "Hamjamiyat qoidalari bilan tanishing."),
      reply("Tadbirlar", "📅", "Yaqin tadbirlar ro'yxati."),
      { text: "Kanalimiz", emoji: "🌐", actionType: "open_url", buttonType: "url" },
      { text: "Adminga yozish", emoji: "📞", actionType: "contact_admin" },
    ],
  },
];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

/* ── Ro'yxat uchun qisqa shakl ───────────────────────────────────────────── */

/** Tanlash oynasi uchun — urug'larning o'zisiz, faqat xulosa. */
export type TemplateOutline = {
  id: string;
  name: string;
  description: string;
  count: number;
  preview: string[];
};

export function templateOutline(template: Template): TemplateOutline {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    count: countSeeds(template.buttons),
    preview: template.buttons.map((seed) =>
      seed.emoji ? `${seed.emoji} ${seed.text}` : seed.text,
    ),
  };
}

export function templateOutlines(): TemplateOutline[] {
  return TEMPLATES.map(templateOutline);
}

/** Ichki menyular bilan birga jami nechta tugma. */
export function countSeeds(seeds: ButtonSeed[]): number {
  return seeds.reduce((total, seed) => total + 1 + countSeeds(seed.children ?? []), 0);
}

/* ── Kalit so'z bo'yicha taklif ──────────────────────────────────────────── */

const KEYWORDS: Record<string, string[]> = {
  // Ichma-ich inline shablonlar birinchi turadi: bir xil kalit so'z
  // uchrasa savatli, chuqur menyuli variant tanlanadi.
  shop: ["do'kon", "dokon", "magazin", "mahsulot", "savdo", "shop", "store", "tovar", "savat"],
  restaurant_menu: ["restoran", "kafe", "taom", "ovqat", "menyu", "pitsa", "food", "cafe"],
  service_menu: ["xizmat", "service", "agentlik", "studiya", "usta"],
  community_menu: ["hamjamiyat", "community", "guruh", "klub"],
  education: ["ta'lim", "talim", "kurs", "o'quv", "maktab", "test", "school", "course"],
  support: ["yordam", "qo'llab", "support", "operator", "murojaat", "faq"],
  booking: ["bron", "navbat", "booking", "sartarosh", "salon", "klinika"],
  delivery: ["yetkaz", "dostavka", "kuryer", "delivery", "taksi"],
  news: ["yangilik", "xabar", "news", "kanal", "blog"],
  ai_assistant: ["ai", "sun'iy", "suniy", "chatbot", "assistant", "yordamchi"],
  personal: ["shaxsiy", "eslatma", "personal", "kundalik"],
};

/**
 * Kategoriya va erkin tavsifdan mos shablonni tanlaydi.
 * Hech narsa mos kelmasa — qo'llab-quvvatlash shabloni (eng universal).
 */
export function suggestTemplate(input: {
  category?: string | null;
  prompt?: string | null;
}): { template: Template; matched: string | null } {
  const haystack = `${input.category ?? ""} ${input.prompt ?? ""}`.toLowerCase();

  let best: { id: string; hits: number } | null = null;
  for (const [id, words] of Object.entries(KEYWORDS)) {
    const hits = words.filter((word) => haystack.includes(word)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { id, hits };
  }

  const template = best ? templateById(best.id) : undefined;
  return {
    template: template ?? templateById("support")!,
    matched: template ? best!.id : null,
  };
}
