/**
 * Mini App uchdan-uchgacha oqimi — HAQIQIY baza bilan.
 *
 * `npm test` dan ataylab ajratilgan: u sof modullarni tekshiradi va bazasiz
 * ishlaydi. Bu fayl esa `npm run test:e2e` bilan yuritiladi va `DATABASE_URL`
 * talab qiladi, chunki maqsad — service qatlami, Prisma va nashr mexanizmi
 * BIRGALIKDA to'g'ri ishlashini tekshirish.
 *
 * Tekshiriladigan oqim:
 *   yaratish → sahifa → ichma-ich komponent → saqlash → nashr → render surati
 *   → autentifikatsiya → API amali (SSRF) → nashrdan olish
 *
 * Xavfsizlik tomoni: yaroqsiz imzo, eskirgan imzo, begona workspace,
 * nashr etilmagan ilova va ichki manzilga so'rov.
 */

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { verifyInitData, InitDataError } from "../../lib/mini-app/auth";
import { validateForm } from "../../lib/mini-app/validate-form";
import { runEndpoint } from "../../lib/mini-app/api-action";
import {
  createMiniApp,
  createPage,
  deleteMiniApp,
  loadBuilderState,
  loadPublishedApp,
  publishMiniApp,
  requireMiniApp,
  saveEndpoint,
  unpublishMiniApp,
  updatePage,
  validateSchema,
  buildSchema,
} from "../../lib/mini-app/service";
import type { MiniAppComponent } from "../../lib/mini-app/schema";

const prisma = new PrismaClient();
const TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw";
const TAG = randomUUID().slice(0, 8);

let userId = "";
let workspaceId = "";
let botId = "";
let appId = "";
let homePageId = "";

const scope = () => ({ workspaceId, actorId: userId });
/** Begona ijarachi — izolyatsiyani tekshirish uchun. */
const foreignScope = () => ({ workspaceId: `ws_begona_${TAG}`, actorId: userId });

function signInitData(fields: Record<string, string>, token = TOKEN): string {
  const checkString = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const initFields = (overrides: Record<string, string> = {}) => ({
  user: JSON.stringify({ id: 77700001, first_name: "E2E", language_code: "uz" }),
  auth_date: String(Math.floor(Date.now() / 1000)),
  ...overrides,
});

before(async () => {
  const user = await prisma.user.create({
    data: { name: "E2E", email: `e2e-${TAG}@example.test`, lang: "uz" },
  });
  userId = user.id;

  const workspace = await prisma.workspace.create({
    data: { id: `ws_e2e_${TAG}`, name: "E2E", slug: `w-e2e-${TAG}` },
  });
  workspaceId = workspace.id;
  await prisma.workspaceMember.create({
    data: { workspaceId, userId, role: "owner" },
  });

  const bot = await prisma.telegramBot.create({
    data: {
      workspaceId,
      ownerId: userId,
      telegramBotId: `e2e-${TAG}`,
      username: `e2e_${TAG}_bot`,
      name: "E2E bot",
      webhookSecret: `secret-${TAG}`,
      status: "active",
    },
  });
  botId = bot.id;
});

after(async () => {
  await prisma.telegramBot.deleteMany({ where: { id: botId } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

/* ── Asosiy oqim ─────────────────────────────────────────────────────────── */

describe("Mini App — to'liq oqim", () => {
  test("1. yaratiladi va bosh sahifa bilan keladi", async () => {
    const app = await createMiniApp(botId, scope(), { name: "E2E App" });
    appId = app.id;

    const state = await loadBuilderState(botId, scope());
    assert.ok(state, "holat yuklanishi kerak");
    assert.equal(state.pages.length, 1);
    assert.equal(state.pages[0].isHome, true);
    assert.equal(state.app.status, "draft");
    homePageId = state.pages[0].id;
  });

  test("2. ikkinchi sahifa qo'shiladi", async () => {
    await createPage(botId, scope(), { name: "Buyurtma", slug: "order" });
    const state = await loadBuilderState(botId, scope());
    assert.deepEqual(
      state!.pages.map((page) => page.slug).sort(),
      ["home", "order"],
    );
  });

  test("3. ICHMA-ICH komponent saqlanadi", async () => {
    const tree: MiniAppComponent[] = [
      {
        id: "c1",
        type: "container",
        props: { direction: "column", gap: 12, padding: 0 },
        children: [
          { id: "h1", type: "heading", props: { text: "Salom", level: 1, align: "center" } },
          {
            id: "i1",
            type: "input",
            props: {
              name: "email",
              label: "Email",
              placeholder: "",
              type: "email",
              required: true,
            },
          },
          {
            id: "b1",
            type: "button",
            props: {
              text: "Yuborish",
              variant: "primary",
              size: "md",
              fullWidth: true,
              action: { kind: "open_page", page: "order" },
            },
          },
        ],
      },
    ];

    await updatePage(botId, scope(), homePageId, { components: tree });

    const state = await loadBuilderState(botId, scope());
    const home = state!.pages.find((page) => page.slug === "home")!;
    assert.equal(home.components.length, 1, "ildizda bitta konteyner");
    assert.equal(home.components[0].children?.length, 3, "konteynerda uch element");
  });

  test("4. buzilgan komponent daraxti QABUL QILINMAYDI", async () => {
    await assert.rejects(() =>
      updatePage(botId, scope(), homePageId, {
        components: [{ id: "x", type: "iframe", props: {} }],
      }),
    );
  });

  test("5. mavjud bo'lmagan sahifaga ulangan tugma nashrni to'xtatadi", async () => {
    const broken = await buildSchema(appId);
    broken.pages[0].components = [
      {
        id: "b2",
        type: "button",
        props: {
          text: "Yo'q",
          variant: "primary",
          size: "md",
          fullWidth: true,
          action: { kind: "open_page", page: "mavjud-emas" },
        },
      },
    ] as MiniAppComponent[];
    assert.ok(validateSchema(broken).some((issue) => issue.code === "missing_page"));
  });

  test("6. nashr etiladi", async () => {
    const result = await publishMiniApp(botId, scope());
    assert.equal(result.version, 1);

    const state = await loadBuilderState(botId, scope());
    assert.equal(state!.app.status, "published");
    assert.equal(state!.hasUnpublishedChanges, false);
  });

  test("7. nashr surati runtime uchun o'qiladi", async () => {
    const published = await loadPublishedApp(appId);
    assert.ok(published, "nashr etilgan ilova ochilishi kerak");
    assert.equal(published.botId, botId);

    const home = published.schema.pages.find((page) => page.slug === "home")!;
    // Ichma-ich tuzilma suratda ham saqlanadi — render aynan shuni o'qiydi.
    assert.equal(home.components[0].children?.length, 3);
  });
});

/* ── Autentifikatsiya ────────────────────────────────────────────────────── */

describe("Mini App — autentifikatsiya", () => {
  test("to'g'ri imzo qabul qilinadi", () => {
    const verified = verifyInitData(TOKEN, signInitData(initFields()));
    assert.equal(verified.user.id, "77700001");
  });

  test("buzilgan imzo rad etiladi", () => {
    const bad = signInitData(initFields()).replace(/hash=[0-9a-f]+/, `hash=${"0".repeat(64)}`);
    assert.throws(() => verifyInitData(TOKEN, bad), InitDataError);
  });

  test("boshqa bot tokeni rad etiladi", () => {
    const other = signInitData(initFields(), "987654321:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ");
    assert.throws(() => verifyInitData(TOKEN, other), InitDataError);
  });

  test("eskirgan imzo rad etiladi", () => {
    const old = String(Math.floor(Date.now() / 1000) - 60 * 60 * 25);
    assert.throws(
      () => verifyInitData(TOKEN, signInitData(initFields({ auth_date: old }))),
      InitDataError,
    );
  });
});

/* ── Forma va API amali ──────────────────────────────────────────────────── */

describe("Mini App — forma va API", () => {
  test("majburiy va email qoidalari ishlaydi", async () => {
    const published = await loadPublishedApp(appId);
    const home = published!.schema.pages.find((page) => page.slug === "home")!;

    assert.equal(validateForm(home.components, {}).length, 1, "bo'sh — xato");
    assert.equal(
      validateForm(home.components, { email: "notanemail" }).length,
      1,
      "noto'g'ri email — xato",
    );
    assert.equal(
      validateForm(home.components, { email: "a@b.uz" }).length,
      0,
      "to'g'ri email — xato yo'q",
    );
  });

  test("ichki manzilli endpoint SAQLANMAYDI", async () => {
    await assert.rejects(
      () =>
        saveEndpoint(botId, scope(), {
          name: "ichki",
          method: "GET",
          url: "https://169.254.169.254/latest/meta-data/",
        }),
      /Manzil qabul qilinmadi/,
    );
  });

  test("localhost endpoint SAQLANMAYDI", async () => {
    await assert.rejects(
      () =>
        saveEndpoint(botId, scope(), {
          name: "lokal",
          method: "GET",
          url: "https://localhost/admin",
        }),
      /Manzil qabul qilinmadi/,
    );
  });

  test("bazaga qo'lda yozilgan ichki manzil ham SO'ROV PAYTIDA to'xtatiladi", async () => {
    // Ikkinchi qavat himoya: yozuv qandaydir yo'l bilan bazaga tushib qolsa
    // ham, so'rov ketishidan oldin qaytadan tekshiriladi.
    const sneaky = await prisma.miniAppEndpoint.create({
      data: {
        miniAppId: appId,
        name: "sneaky",
        method: "GET",
        url: "https://127.0.0.1/secrets",
      },
    });

    const outcome = await runEndpoint({
      miniAppId: appId,
      endpointId: sneaky.id,
      values: {},
      allowlist: [],
    });

    assert.equal(outcome.ok, false);
    assert.match((outcome as { error: string }).error, /Manzil qabul qilinmadi/);
  });

  test("allowlist tashqarisidagi domen to'xtatiladi", async () => {
    const endpoint = await prisma.miniAppEndpoint.create({
      data: {
        miniAppId: appId,
        name: "tashqi",
        method: "GET",
        url: "https://example.com/data",
      },
    });

    const outcome = await runEndpoint({
      miniAppId: appId,
      endpointId: endpoint.id,
      values: {},
      allowlist: ["ruxsat.example.org"],
    });

    assert.equal(outcome.ok, false);
    assert.match((outcome as { error: string }).error, /ro'yxatida yo'q/);
  });

  test("noma'lum endpoint 404 beradi", async () => {
    const outcome = await runEndpoint({
      miniAppId: appId,
      endpointId: "yoq",
      values: {},
      allowlist: [],
    });
    assert.equal(outcome.ok, false);
    assert.equal((outcome as { status: number }).status, 404);
  });
});

/* ── Izolyatsiya va nashr nazorati ───────────────────────────────────────── */

describe("Mini App — kirish nazorati", () => {
  test("begona workspace Mini App'ni ko'ra olmaydi", async () => {
    await assert.rejects(() => requireMiniApp(botId, foreignScope()), /topilmadi/i);
  });

  test("begona workspace nashr eta olmaydi", async () => {
    await assert.rejects(() => publishMiniApp(botId, foreignScope()), /topilmadi/i);
  });

  test("nashrdan olingan ilova ochilmaydi", async () => {
    await unpublishMiniApp(botId, scope());
    assert.equal(await loadPublishedApp(appId), null);
  });

  test("o'chirilgan ilova ochilmaydi", async () => {
    await deleteMiniApp(botId, scope());
    assert.equal(await loadPublishedApp(appId), null);
    await assert.rejects(() => requireMiniApp(botId, scope()), /topilmadi/i);
  });
});
