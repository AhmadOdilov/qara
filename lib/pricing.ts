/**
 * Tarif katalogi.
 *
 * Narx UI'da emas, shu yerda turadi — sahifa faqat ko'rsatadi. Har bir qiymat
 * muhit o'zgaruvchisi bilan almashtiriladi, ya'ni narxni o'zgartirish uchun
 * deploy shart emas.
 *
 * Billing modeli hozir `per_workspace` — bitta ish maydoni uchun oylik to'lov,
 * chegaralar bot soni va FAOL obunachi bo'yicha. `BILLING_MODEL` ni
 * o'zgartirish bilan `per_bot` yoki `ai_usage` ga o'tish mumkin: chegaralar
 * shakli o'zgarmaydi, faqat qaysi biri hisob asosiga olinishi o'zgaradi.
 *
 * Nega faol obunachi? Bot bilan oxirgi 30 kunda muloqot qilganlar sanaladi.
 * O'lik obunachidan pul olish — raqobatchilarga eng ko'p aytiladigan e'tiroz
 * va O'zbekistonda ayniqsa og'riqli: Telegram auditoriyasi katta, tijorat
 * faolligi kichik.
 */

/** Hisob nimaga qarab olinadi. Kelajakda almashtirish uchun ochiq qoldirilgan. */
export const BILLING_MODELS = [
  "per_workspace",
  "per_bot",
  "per_active_subscriber",
  "ai_usage",
] as const;

export type BillingModel = (typeof BILLING_MODELS)[number];

export const BILLING_MODEL: BillingModel = readBillingModel();

export const PLAN_IDS = ["free", "starter", "business", "pro", "enterprise"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** `null` — cheksiz (yoki enterprise'da kelishuv bo'yicha). */
export type PlanLimits = {
  bots: number | null;
  /** Oxirgi 30 kunda bot bilan muloqot qilgan foydalanuvchilar. */
  activeSubscribers: number | null;
  miniApps: number | null;
  /** Ish maydoni a'zolari. */
  members: number | null;
  /** Oyiga AI reja generatsiyasi. */
  aiPlansPerMonth: number | null;
};

export type Plan = {
  id: PlanId;
  /** Oylik narx, so'mda. `null` — narx kelishuv bo'yicha. */
  monthlyUzs: number | null;
  /** Bot orqali o'tgan tushumdan olinadigan foiz. 0 — komissiya yo'q. */
  gmvFeePercent: number;
  limits: PlanLimits;
  /** Lug'atdagi `pricing.f<Key>` kalitlari — matn shu yerda takrorlanmaydi. */
  featureKeys: readonly string[];
  /** To'lov qabul qilish (Payme/Click) shu tarifda yoqiladimi. */
  payments: boolean;
  /** Narxlar jadvalida ajratib ko'rsatiladigan tarif. */
  highlighted: boolean;
};

/**
 * Yillik to'lovda nechta oy hisoblanadi. 10 — «12 oyga 10 oy to'lang».
 * Foiz emas, oy sifatida saqlanadi: mahalliy mijoz uni shunday tushunadi.
 */
export const ANNUAL_MONTHS_CHARGED = readInt("QARA_ANNUAL_MONTHS", 10);

/**
 * USD ga taxminiy o'tkazish kursi — faqat KO'RSATISH uchun.
 * Hisob-kitob har doim so'mda ketadi.
 */
export const USD_RATE = readInt("QARA_USD_RATE", 12_000);

const PLANS: readonly Plan[] = [
  {
    id: "free",
    monthlyUzs: 0,
    gmvFeePercent: readNumber("QARA_PRICE_FREE_GMV_FEE", 1),
    limits: {
      bots: 1,
      activeSubscribers: 100,
      miniApps: 0,
      members: 1,
      aiPlansPerMonth: 3,
    },
    featureKeys: ["oneBot", "visualBuilder", "templates", "testMode", "basicAnalytics"],
    payments: true,
    highlighted: false,
  },
  {
    id: "starter",
    monthlyUzs: readInt("QARA_PRICE_STARTER_UZS", 99_000),
    gmvFeePercent: 0,
    limits: {
      bots: 1,
      activeSubscribers: 3_000,
      miniApps: 1,
      members: 2,
      aiPlansPerMonth: null,
    },
    featureKeys: ["localPayments", "miniApp", "unlimitedAi", "orders", "fullAnalytics"],
    payments: true,
    highlighted: true,
  },
  {
    id: "business",
    monthlyUzs: readInt("QARA_PRICE_BUSINESS_UZS", 299_000),
    gmvFeePercent: 0,
    limits: {
      bots: 3,
      activeSubscribers: 25_000,
      miniApps: null,
      members: null,
      aiPlansPerMonth: null,
    },
    featureKeys: [
      "unlimitedMembers",
      "unlimitedMiniApps",
      "automations",
      "integrations",
      "apiAccess",
    ],
    payments: true,
    highlighted: false,
  },
  {
    id: "pro",
    monthlyUzs: readInt("QARA_PRICE_PRO_UZS", 899_000),
    gmvFeePercent: 0,
    limits: {
      bots: 10,
      activeSubscribers: 100_000,
      miniApps: null,
      members: null,
      aiPlansPerMonth: null,
    },
    featureKeys: ["whiteLabel", "clientWorkspaces", "knowledgeBase", "prioritySupport"],
    payments: true,
    highlighted: false,
  },
  {
    id: "enterprise",
    monthlyUzs: null,
    gmvFeePercent: 0,
    limits: {
      bots: null,
      activeSubscribers: null,
      miniApps: null,
      members: null,
      aiPlansPerMonth: null,
    },
    featureKeys: ["sla", "dataResidency", "auditExport", "dedicatedManager", "invoice"],
    payments: true,
    highlighted: false,
  },
];

export function listPlans(): readonly Plan[] {
  return PLANS;
}

export function planById(id: string): Plan | null {
  return PLANS.find((plan) => plan.id === id) ?? null;
}

/** Yillik narx — `ANNUAL_MONTHS_CHARGED` oy uchun. */
export function annualUzs(plan: Plan): number | null {
  if (plan.monthlyUzs === null) return null;
  return plan.monthlyUzs * ANNUAL_MONTHS_CHARGED;
}

/** «99 000» — guruhlar orasida uzilmas probel, satr o'rtasida sinmasin. */
export function formatUzs(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Taxminiy USD — yaxlitlangan, «≈» belgisi bilan ko'rsatiladi. */
export function approxUsd(uzs: number): number {
  return Math.round(uzs / USD_RATE);
}

function readInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readNumber(name: string, fallback: number): number {
  const parsed = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readBillingModel(): BillingModel {
  const value = process.env.QARA_BILLING_MODEL?.trim();
  return (BILLING_MODELS as readonly string[]).includes(value ?? "")
    ? (value as BillingModel)
    : "per_workspace";
}
