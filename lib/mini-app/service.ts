import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/bots/audit";
import { BotServiceError, requireBot, type BotScope } from "@/lib/bots/service";
import { describeHeaders, normalizeMethod } from "@/lib/mini-app/api-action";
import { assertSafeUrl, SsrfError } from "@/lib/mini-app/ssrf";
import {
  componentTreeSchema,
  MAX_PAGES,
  PAGE_SLUG,
  settingsSchema,
  themeSchema,
  type MiniAppComponent,
  type MiniAppSchema,
} from "@/lib/mini-app/schema";

/**
 * Mini App hayot tsikli: yaratish, sahifalar, nashr va public surat.
 *
 * Qoralama/nashr ajratmasi tugmalar tizimidagi bilan bir xil qoidada
 * (`buttons/store.ts`): konstruktor `mini_app_pages` ni tahrirlaydi, Telegram
 * ochadigan Mini App esa faqat oxirgi `MiniAppDeployment.schema` suratini
 * o'qiydi. Shu sababli yarim tahrirlangan sahifa hech qachon foydalanuvchiga
 * ko'rinmaydi.
 *
 * KIRISH HUQUQI: har bir yozuv botga, bot esa workspace'ga bog'langan.
 * Konstruktor tomonidagi hamma funksiya `BotScope` talab qiladi va
 * `requireBot()` orqali o'tadi — begona workspace uchun «topilmadi» qaytadi.
 */

/* ── Public manzil ───────────────────────────────────────────────────────── */

export function miniAppUrl(appId: string): string {
  return `${env.appUrl}/mini-app/${appId}`;
}

/**
 * Telegram Mini App'ni faqat HTTPS manzildan ochadi.
 * Lokal ishlashda (`http://localhost`) konstruktor va preview ishlaydi,
 * lekin botga ulash uchun tunnel kerak — UI shuni ochiq aytadi.
 */
export function miniAppHostingAvailable(): boolean {
  return env.appUrl.startsWith("https://");
}

/* ── O'qish ──────────────────────────────────────────────────────────────── */

/** Botning Mini App'i. Yo'q bo'lsa `null` — bu xato emas. */
export async function findMiniApp(botId: string, scope: BotScope) {
  await requireBot(botId, scope);
  return prisma.miniApp.findUnique({
    where: { botId },
    include: {
      pages: { orderBy: { sortOrder: "asc" } },
      deployments: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true, publishedAt: true },
      },
    },
  });
}

/** Mini App majburiy — yo'q bo'lsa 404. */
export async function requireMiniApp(botId: string, scope: BotScope) {
  const app = await findMiniApp(botId, scope);
  if (!app) throw new BotServiceError("Mini App topilmadi", 404);
  return app;
}

/** Konstruktor bir marta oladigan to'liq holat. */
export async function loadBuilderState(botId: string, scope: BotScope) {
  const app = await findMiniApp(botId, scope);
  if (!app) return null;

  const [latest, changed, endpoints] = await Promise.all([
    latestVersion(app.id),
    hasUnpublishedChanges(app.id),
    listEndpoints(botId, scope),
  ]);

  return {
    app: {
      id: app.id,
      name: app.name,
      status: app.status,
      theme: app.theme,
      settings: app.settings,
      publishedAt: app.publishedAt,
      url: miniAppUrl(app.id),
      apiAllowlist: app.apiAllowlist,
    },
    endpoints,
    pages: app.pages.map((page) => ({
      id: page.id,
      name: page.name,
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      sortOrder: page.sortOrder,
      components: page.components as unknown as MiniAppComponent[],
    })),
    publishedVersion: latest,
    hasUnpublishedChanges: changed,
    hostingAvailable: miniAppHostingAvailable(),
  };
}

export async function latestVersion(miniAppId: string): Promise<number> {
  const row = await prisma.miniAppDeployment.findFirst({
    where: { miniAppId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return row?.version ?? 0;
}

/**
 * Qoralama nashrdan farq qiladimi.
 *
 * Taqqoslash suratlar bo'yicha: `jsonb` kalitlar tartibini o'zgartirgani
 * uchun `JSON.stringify` yaramaydi — barqaror shakl ishlatiladi.
 */
async function hasUnpublishedChanges(miniAppId: string): Promise<boolean> {
  const [draft, published] = await Promise.all([
    buildSchema(miniAppId),
    prisma.miniAppDeployment.findFirst({
      where: { miniAppId },
      orderBy: { version: "desc" },
      select: { schema: true },
    }),
  ]);
  if (!published) return true;
  return stableJson(draft) !== stableJson(published.schema);
}

/* ── Yaratish va o'zgartirish ────────────────────────────────────────────── */

/** Yangi Mini App — bitta bo'sh «Bosh sahifa» bilan birga keladi. */
export async function createMiniApp(
  botId: string,
  scope: BotScope,
  input: { name?: string },
) {
  const bot = await requireBot(botId, scope);

  const existing = await prisma.miniApp.findUnique({ where: { botId } });
  if (existing) throw new BotServiceError("Bu botda Mini App allaqachon bor", 409);

  const app = await prisma.miniApp.create({
    data: {
      botId,
      workspaceId: scope.workspaceId,
      name: input.name?.trim() || `${bot.name} App`,
      createdById: scope.actorId,
      // Bo'sh ilova boshi berk ko'cha bo'lmasin: birinchi sahifa darhol bor.
      pages: {
        create: {
          name: "Bosh sahifa",
          slug: "home",
          isHome: true,
          sortOrder: 0,
          components: [] as unknown as Prisma.InputJsonValue,
        },
      },
    },
  });

  await audit("BOT_UPDATED", {
    botId,
    actorId: scope.actorId,
    metadata: { miniAppCreated: app.id },
  });

  return app;
}

export async function updateMiniApp(
  botId: string,
  scope: BotScope,
  patch: { name?: string; theme?: unknown; settings?: unknown },
) {
  const app = await requireMiniApp(botId, scope);

  const data: Prisma.MiniAppUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name.trim().slice(0, 64);
  if (patch.theme !== undefined) {
    data.theme = themeSchema.parse(patch.theme) as unknown as Prisma.InputJsonValue;
  }
  if (patch.settings !== undefined) {
    data.settings = settingsSchema.parse(patch.settings) as unknown as Prisma.InputJsonValue;
  }

  return prisma.miniApp.update({ where: { id: app.id }, data });
}

export async function deleteMiniApp(botId: string, scope: BotScope): Promise<void> {
  const app = await requireMiniApp(botId, scope);

  // Botdagi ishga tushirish nuqtalari ham tozalanadi — o'chirilgan ilovaga
  // olib boradigan tugma qolib ketmasligi kerak.
  await prisma.miniApp.delete({ where: { id: app.id } });
  await prisma.telegramBot.update({
    where: { id: botId },
    data: { miniAppEnabled: false, miniAppUrl: null, miniAppName: null },
  });

  await audit("BOT_UPDATED", {
    botId,
    actorId: scope.actorId,
    metadata: { miniAppDeleted: app.id },
  });
}

/* ── Sahifalar ───────────────────────────────────────────────────────────── */

export async function createPage(
  botId: string,
  scope: BotScope,
  input: { name: string; slug: string; title?: string | null },
) {
  const app = await requireMiniApp(botId, scope);

  if (app.pages.length >= MAX_PAGES) {
    throw new BotServiceError(`Sahifalar soni ${MAX_PAGES} tadan oshmasligi kerak`, 422);
  }

  const slug = PAGE_SLUG.parse(input.slug);
  if (app.pages.some((page) => page.slug === slug)) {
    throw new BotServiceError("Bunday manzilli sahifa allaqachon bor", 409);
  }

  return prisma.miniAppPage.create({
    data: {
      miniAppId: app.id,
      name: input.name.trim().slice(0, 64) || slug,
      slug,
      title: input.title?.trim() || null,
      // Birinchi sahifa avtomatik bosh sahifa bo'ladi.
      isHome: app.pages.length === 0,
      sortOrder: app.pages.length,
      components: [] as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function updatePage(
  botId: string,
  scope: BotScope,
  pageId: string,
  patch: {
    name?: string;
    slug?: string;
    title?: string | null;
    isHome?: boolean;
    components?: unknown;
  },
) {
  const app = await requireMiniApp(botId, scope);
  const page = app.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new BotServiceError("Sahifa topilmadi", 404);

  const data: Prisma.MiniAppPageUpdateInput = {};

  if (patch.name !== undefined) data.name = patch.name.trim().slice(0, 64) || page.slug;
  if (patch.title !== undefined) data.title = patch.title?.trim() || null;

  if (patch.slug !== undefined) {
    const slug = PAGE_SLUG.parse(patch.slug);
    if (app.pages.some((other) => other.slug === slug && other.id !== pageId)) {
      throw new BotServiceError("Bunday manzilli sahifa allaqachon bor", 409);
    }
    data.slug = slug;
  }

  if (patch.components !== undefined) {
    // Komponent daraxti HAR DOIM tekshiriladi: konstruktor klientda ishlaydi,
    // shuning uchun serverga kelgan shaklga ishonib bo'lmaydi.
    data.components = componentTreeSchema.parse(
      patch.components,
    ) as unknown as Prisma.InputJsonValue;
  }

  const updated = await prisma.miniAppPage.update({ where: { id: pageId }, data });

  // Bosh sahifa bitta bo'ladi — yangisi belgilansa eskisi bo'shatiladi.
  if (patch.isHome === true) {
    await prisma.$transaction([
      prisma.miniAppPage.updateMany({
        where: { miniAppId: app.id, id: { not: pageId } },
        data: { isHome: false },
      }),
      prisma.miniAppPage.update({ where: { id: pageId }, data: { isHome: true } }),
    ]);
  }

  return updated;
}

export async function deletePage(
  botId: string,
  scope: BotScope,
  pageId: string,
): Promise<void> {
  const app = await requireMiniApp(botId, scope);
  const page = app.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new BotServiceError("Sahifa topilmadi", 404);

  if (app.pages.length === 1) {
    throw new BotServiceError("Oxirgi sahifani o'chirib bo'lmaydi", 422);
  }

  await prisma.miniAppPage.delete({ where: { id: pageId } });

  // Bosh sahifa o'chirilgan bo'lsa — eng birinchisi uning o'rnini oladi,
  // aks holda Mini App ochilganda ko'rsatadigan sahifasi qolmasdi.
  if (page.isHome) {
    const next = await prisma.miniAppPage.findFirst({
      where: { miniAppId: app.id },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.miniAppPage.update({
        where: { id: next.id },
        data: { isHome: true },
      });
    }
  }
}

/* ── API endpointlari ────────────────────────────────────────────────────── */

/**
 * Endpointlarni konstruktor uchun xavfsiz shaklda qaytaradi.
 *
 * `headers` QIYMATLARI hech qachon chiqmaydi — ular API kalitlarini
 * saqlashi mumkin. UI'ga faqat kalit NOMLARI beriladi, xuddi bot sirlarida
 * maska berilgani kabi.
 */
export async function listEndpoints(botId: string, scope: BotScope) {
  const app = await requireMiniApp(botId, scope);
  const rows = await prisma.miniAppEndpoint.findMany({
    where: { miniAppId: app.id },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    method: row.method,
    url: row.url,
    headerKeys: describeHeaders(row.headers),
    bodyTemplate: row.bodyTemplate,
    responseMap: row.responseMap,
    timeoutMs: row.timeoutMs,
  }));
}

export type EndpointInput = {
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  bodyTemplate?: unknown;
  responseMap?: unknown;
  timeoutMs?: number;
};

/**
 * Endpoint yaratish/yangilash.
 *
 * Manzil SAQLASH paytida ham tekshiriladi — yaroqsiz konfiguratsiya bazaga
 * tushmasligi kerak. So'rov ketishidan oldin u yana bir bor tekshiriladi
 * (DNS bilan), chunki domen keyin ichki manzilga burilishi mumkin.
 */
export async function saveEndpoint(
  botId: string,
  scope: BotScope,
  input: EndpointInput,
  endpointId?: string,
) {
  const app = await requireMiniApp(botId, scope);

  try {
    assertSafeUrl(input.url, app.apiAllowlist);
  } catch (error) {
    if (error instanceof SsrfError) {
      throw new BotServiceError(`Manzil qabul qilinmadi: ${error.message}`, 422);
    }
    throw error;
  }

  const data = {
    name: input.name.trim().slice(0, 64),
    method: normalizeMethod(input.method),
    url: input.url.trim(),
    ...(input.headers !== undefined
      ? { headers: input.headers as Prisma.InputJsonValue }
      : {}),
    ...(input.bodyTemplate !== undefined
      ? { bodyTemplate: input.bodyTemplate as Prisma.InputJsonValue }
      : {}),
    ...(input.responseMap !== undefined
      ? { responseMap: input.responseMap as Prisma.InputJsonValue }
      : {}),
    ...(input.timeoutMs !== undefined
      ? { timeoutMs: Math.min(Math.max(input.timeoutMs, 1000), 15_000) }
      : {}),
  };

  if (endpointId) {
    const existing = await prisma.miniAppEndpoint.findFirst({
      where: { id: endpointId, miniAppId: app.id },
      select: { id: true },
    });
    if (!existing) throw new BotServiceError("Amal topilmadi", 404);
    return prisma.miniAppEndpoint.update({ where: { id: endpointId }, data });
  }

  return prisma.miniAppEndpoint.create({ data: { ...data, miniAppId: app.id } });
}

export async function deleteEndpoint(
  botId: string,
  scope: BotScope,
  endpointId: string,
): Promise<void> {
  const app = await requireMiniApp(botId, scope);
  const existing = await prisma.miniAppEndpoint.findFirst({
    where: { id: endpointId, miniAppId: app.id },
    select: { id: true },
  });
  if (!existing) throw new BotServiceError("Amal topilmadi", 404);
  await prisma.miniAppEndpoint.delete({ where: { id: endpointId } });
}

/** Ruxsat etilgan domenlar ro'yxatini yangilaydi. */
export async function setAllowlist(
  botId: string,
  scope: BotScope,
  domains: string[],
): Promise<string[]> {
  const app = await requireMiniApp(botId, scope);
  const clean = domains
    .map((domain) => domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))
    .slice(0, 20);

  const updated = await prisma.miniApp.update({
    where: { id: app.id },
    data: { apiAllowlist: clean },
    select: { apiAllowlist: true },
  });
  return updated.apiAllowlist;
}

/* ── Nashr ───────────────────────────────────────────────────────────────── */

/** Nashrni to'xtatadigan muammolar. */
export type MiniAppIssue = { code: string; message: string; pageSlug?: string };

/**
 * Nashrdan oldingi tekshiruv.
 *
 * Faqat haqiqatan ishlamaydigan holatlar xato bo'ladi — qolgani egasining
 * ixtiyorida. Tugmalar tizimidagi `validate.ts` bilan bir xil qattiqlik.
 */
export function validateSchema(schema: MiniAppSchema): MiniAppIssue[] {
  const issues: MiniAppIssue[] = [];
  const slugs = new Set(schema.pages.map((page) => page.slug));

  if (schema.pages.length === 0) {
    issues.push({ code: "no_pages", message: "Kamida bitta sahifa kerak" });
  }
  if (!schema.pages.some((page) => page.isHome)) {
    issues.push({ code: "no_home", message: "Bosh sahifa belgilanmagan" });
  }

  const checkAction = (
    action: { kind: string; page?: string; url?: string } | undefined,
    where: string,
    pageSlug: string,
  ) => {
    if (!action) return;
    if (action.kind === "open_page") {
      if (!action.page || !slugs.has(action.page)) {
        issues.push({
          code: "missing_page",
          pageSlug,
          message: `«${where}» mavjud bo'lmagan sahifaga ulangan`,
        });
      }
    }
    if (action.kind === "open_url" && !isHttps(action.url)) {
      issues.push({
        code: "invalid_url",
        pageSlug,
        message: `«${where}» uchun HTTPS manzil ko'rsatilmagan`,
      });
    }
  };

  for (const page of schema.pages) {
    const walk = (nodes: MiniAppComponent[]) => {
      for (const node of nodes) {
        if (node.type === "button") checkAction(node.props.action, node.props.text, page.slug);
        if (node.type === "product") {
          checkAction(node.props.action, node.props.title, page.slug);
        }
        if (node.children?.length) walk(node.children);
      }
    };
    walk(page.components);
  }

  checkAction(schema.settings.mainButtonAction, "MainButton", schema.pages[0]?.slug ?? "");

  return issues;
}

function isHttps(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Qoralamadan surat yig'adi — nashr ham, taqqoslash ham shuni ishlatadi. */
export async function buildSchema(miniAppId: string): Promise<MiniAppSchema> {
  const app = await prisma.miniApp.findUniqueOrThrow({
    where: { id: miniAppId },
    include: { pages: { orderBy: { sortOrder: "asc" } } },
  });

  return {
    id: app.id,
    name: app.name,
    theme: themeSchema.parse(app.theme ?? {}),
    settings: settingsSchema.parse(app.settings ?? {}),
    pages: app.pages.map((page) => ({
      id: page.id,
      name: page.name,
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      components: page.components as unknown as MiniAppComponent[],
    })),
  };
}

export class MiniAppValidationError extends BotServiceError {
  constructor(readonly issues: MiniAppIssue[]) {
    super("Mini App'da xato bor — nashr to'xtatildi", 422);
    this.name = "MiniAppValidationError";
  }
}

export async function publishMiniApp(botId: string, scope: BotScope) {
  const app = await requireMiniApp(botId, scope);

  const schema = await buildSchema(app.id);
  const issues = validateSchema(schema);
  if (issues.length > 0) throw new MiniAppValidationError(issues);

  const version = (await latestVersion(app.id)) + 1;

  const deployment = await prisma.miniAppDeployment.create({
    data: {
      miniAppId: app.id,
      version,
      schema: schema as unknown as Prisma.InputJsonValue,
      summary: {
        pages: schema.pages.length,
        components: schema.pages.reduce((n, page) => n + page.components.length, 0),
      } as unknown as Prisma.InputJsonValue,
      publishedById: scope.actorId,
    },
  });

  await prisma.miniApp.update({
    where: { id: app.id },
    data: { status: "published", publishedAt: deployment.publishedAt },
  });

  // Jonli Mini App yangi suratni darhol ko'rishi kerak.
  invalidate(app.id);

  await audit("BOT_UPDATED", {
    botId,
    actorId: scope.actorId,
    metadata: { miniAppPublished: version },
  });

  return { version, url: miniAppUrl(app.id), issues: [] as MiniAppIssue[] };
}

/** Nashrdan olish — manzil ochilmay qoladi, qoralama saqlanadi. */
export async function unpublishMiniApp(botId: string, scope: BotScope) {
  const app = await requireMiniApp(botId, scope);
  const updated = await prisma.miniApp.update({
    where: { id: app.id },
    data: { status: "unpublished" },
  });
  invalidate(app.id);
  return updated;
}

/* ── Analitika ───────────────────────────────────────────────────────────── */

export type MiniAppAnalytics = {
  opens: number;
  uniqueUsers: number;
  pageViews: number;
  buttonClicks: number;
  apiCalls: number;
  errors: number;
  topPages: { slug: string; views: number }[];
  recent: {
    id: string;
    eventType: string;
    pageSlug: string | null;
    createdAt: Date;
    reason: string | null;
  }[];
};

/**
 * Mini App ko'rsatkichlari — FAQAT haqiqiy `mini_app_events` yozuvlaridan.
 *
 * Hech qanday taxminiy yoki to'ldirilgan son yo'q: yozuv bo'lmasa nol
 * qaytadi va UI bo'sh holatni ko'rsatadi.
 */
export async function miniAppAnalytics(
  botId: string,
  scope: BotScope,
): Promise<MiniAppAnalytics> {
  const app = await requireMiniApp(botId, scope);

  const [byType, uniqueUsers, byPage, recent] = await Promise.all([
    prisma.miniAppEvent.groupBy({
      by: ["eventType"],
      where: { miniAppId: app.id },
      _count: { _all: true },
    }),
    prisma.miniAppEvent.findMany({
      where: { miniAppId: app.id, telegramUserId: { not: null } },
      distinct: ["telegramUserId"],
      select: { telegramUserId: true },
    }),
    prisma.miniAppEvent.groupBy({
      by: ["pageSlug"],
      where: { miniAppId: app.id, eventType: "page_view", pageSlug: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { pageSlug: "desc" } },
      take: 5,
    }),
    prisma.miniAppEvent.findMany({
      where: { miniAppId: app.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, eventType: true, pageSlug: true, createdAt: true, detail: true },
    }),
  ]);

  const count = (type: string) =>
    byType.find((row) => row.eventType === type)?._count._all ?? 0;

  return {
    opens: count("open"),
    uniqueUsers: uniqueUsers.length,
    pageViews: count("page_view"),
    buttonClicks: count("button_click"),
    apiCalls: count("api_call"),
    errors: count("error"),
    topPages: byPage.map((row) => ({
      slug: row.pageSlug ?? "—",
      views: row._count._all,
    })),
    recent: recent.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      pageSlug: row.pageSlug,
      createdAt: row.createdAt,
      reason: (row.detail as { reason?: string } | null)?.reason ?? null,
    })),
  };
}

/* ── Public surat (runtime o'qiydi) ──────────────────────────────────────── */

type CacheEntry = { schema: MiniAppSchema; botId: string; expires: number };

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function invalidate(appId: string): void {
  cache.delete(appId);
}

/**
 * Telegram ochgan Mini App uchun surat.
 *
 * `null` — ilova yo'q yoki nashr etilmagan. Bu holat runtime'da «mavjud emas»
 * sahifasiga aylanadi: nashr etilmagan ilova hech kimga ko'rinmasligi kerak.
 */
export async function loadPublishedApp(
  appId: string,
): Promise<{ schema: MiniAppSchema; botId: string } | null> {
  const cached = cache.get(appId);
  if (cached && cached.expires > Date.now()) {
    return { schema: cached.schema, botId: cached.botId };
  }

  const app = await prisma.miniApp.findUnique({
    where: { id: appId },
    select: {
      botId: true,
      status: true,
      bot: { select: { status: true } },
      deployments: {
        orderBy: { version: "desc" },
        take: 1,
        select: { schema: true },
      },
    },
  });

  if (!app || app.status !== "published") return null;
  // To'xtatilgan botning Mini App'i ham ochilmaydi.
  if (app.bot.status === "disabled") return null;

  const snapshot = app.deployments[0];
  if (!snapshot) return null;

  const schema = snapshot.schema as unknown as MiniAppSchema;
  cache.set(appId, { schema, botId: app.botId, expires: Date.now() + TTL_MS });
  return { schema, botId: app.botId };
}

/* ── Yordamchi ───────────────────────────────────────────────────────────── */

/** Kalitlari tartiblangan JSON — `jsonb` taqqoslash uchun. */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}
