/**
 * Botni konfiguratsiyadan nusxalash — HAQIQIY baza bilan (§28, §10).
 *
 * Bu testning markaziy da'vosi ikkita va ular teng darajada muhim:
 *   1. SOZLAMA ko'chadi — menyu, tugmalar, buyruqlar, javob matnlari.
 *   2. TOKEN VA SIRLAR ko'chMAYDI — nusxa hech qachon manba botning
 *      Telegram identifikatorini yoki tokenini olmaydi.
 *
 * Uchinchisi — ijarachilik: begona workspace boshqa botdan nusxa ololmaydi.
 *
 * `npm run test:e2e` bilan yuritiladi va `DATABASE_URL` talab qiladi.
 */

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { duplicateBotConfig } from "../../lib/bots/duplicate";
import { BotServiceError } from "../../lib/bots/service";
import { writeSecret, readSecret } from "../../lib/bots/secrets";
import { blueprintSchema } from "../../lib/ai/blueprint";

const prisma = new PrismaClient();
const TAG = randomUUID().slice(0, 8);
const SOURCE_TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw";

let userId = "";
let workspaceId = "";
let foreignWorkspaceId = "";
let botId = "";
let planId = "";

const scope = () => ({ workspaceId, actorId: userId });

before(async () => {
  const user = await prisma.user.create({
    data: { name: "E2E nusxa", email: `e2e-dup-${TAG}@example.test`, lang: "uz" },
  });
  userId = user.id;

  const workspace = await prisma.workspace.create({
    data: { id: `ws_dup_${TAG}`, name: "E2E nusxa", slug: `w-dup-${TAG}` },
  });
  workspaceId = workspace.id;
  await prisma.workspaceMember.create({
    data: { workspaceId, userId, role: "owner" },
  });

  const foreign = await prisma.workspace.create({
    data: { id: `ws_dup_b_${TAG}`, name: "Begona", slug: `w-dup-b-${TAG}` },
  });
  foreignWorkspaceId = foreign.id;

  const bot = await prisma.telegramBot.create({
    data: {
      workspaceId,
      ownerId: userId,
      telegramBotId: `dup-${TAG}`,
      username: `dup_${TAG}_bot`,
      name: "Manba bot",
      description: "Nusxalash uchun manba",
      category: "education",
      features: ["courses", "analytics"],
      webhookSecret: `secret-${TAG}`,
      status: "active",
    },
  });
  botId = bot.id;

  // Sir — nusxaga TUSHMASLIGI kerak.
  await writeSecret(botId, "telegram_token", SOURCE_TOKEN);

  await prisma.telegramBotCommand.createMany({
    data: [
      {
        botId,
        command: "start",
        description: "Botni ishga tushirish",
        actionType: "send_message",
        actionConfig: { text: "Salom! Bu manba bot." },
        sortOrder: 0,
      },
      {
        botId,
        command: "help",
        description: "Yordam",
        actionType: "send_message",
        actionConfig: { text: "Yordam matni." },
        sortOrder: 1,
      },
    ],
  });

  // Ikki qatlamli menyu: Kurslar → (Python, Java), Narxlar
  const courses = await prisma.telegramBotButton.create({
    data: {
      botId,
      text: "Kurslar",
      emoji: "📚",
      actionType: "submenu",
      buttonType: "submenu",
      actionConfig: {},
      sortOrder: 0,
    },
  });
  await prisma.telegramBotButton.createMany({
    data: [
      {
        botId,
        parentId: courses.id,
        text: "Python",
        actionType: "send_message",
        actionConfig: { text: "Python kursi haqida." },
        sortOrder: 0,
      },
      {
        botId,
        parentId: courses.id,
        text: "Java",
        actionType: "send_message",
        actionConfig: { text: "Java kursi haqida." },
        sortOrder: 1,
      },
      {
        botId,
        text: "Narxlar",
        emoji: "💳",
        actionType: "send_message",
        actionConfig: { text: "Oylik 100 000 so'm." },
        sortOrder: 1,
      },
    ],
  });

  await prisma.telegramBotAiConfig.create({
    data: { botId, enabled: true, systemPrompt: "Siz o'qituvchi yordamchisisiz." },
  });
});

after(async () => {
  await prisma.botBlueprint.deleteMany({ where: { workspaceId } });
  await prisma.telegramBot.deleteMany({ where: { id: botId } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({
    where: { id: { in: [workspaceId, foreignWorkspaceId] } },
  });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("Nusxalash — sozlama ko'chadi", () => {
  test("1. qoralama reja yaratiladi", async () => {
    const result = await duplicateBotConfig(botId, scope(), {
      name: "Nusxa bot",
    });
    planId = result.planId;

    assert.ok(planId, "planId qaytmadi");
    assert.equal(result.commandCount, 2);
    assert.equal(result.buttonCount, 4);
    // Daraxt ikki qatlam — chuqurroq shox yo'q.
    assert.equal(result.droppedDeeper, 0);
  });

  test("2. reja bazada va sxemaga mos", async () => {
    const draft = await prisma.botBlueprint.findUniqueOrThrow({
      where: { id: planId },
    });
    assert.equal(draft.workspaceId, workspaceId);
    assert.equal(draft.status, "draft");
    assert.equal(draft.botId, null, "qoralama hali botga bog'lanmagan bo'lishi kerak");

    const parsed = blueprintSchema.safeParse(draft.plan);
    assert.ok(parsed.success, "saqlangan reja sxemaga mos emas");
  });

  test("3. menyu daraxti to'liq ko'chgan", async () => {
    const draft = await prisma.botBlueprint.findUniqueOrThrow({
      where: { id: planId },
    });
    const plan = blueprintSchema.parse(draft.plan);

    assert.deepEqual(
      plan.menu.map((item) => item.text),
      ["Kurslar", "Narxlar"],
    );
    assert.deepEqual(
      plan.menu[0].children.map((child) => child.text),
      ["Python", "Java"],
    );
    assert.equal(plan.menu[0].emoji, "📚");
    assert.equal(plan.menu[1].reply, "Oylik 100 000 so'm.");
    assert.equal(plan.menu[0].children[0].reply, "Python kursi haqida.");
  });

  test("4. buyruqlar va salomlashuv ko'chgan", async () => {
    const plan = blueprintSchema.parse(
      (await prisma.botBlueprint.findUniqueOrThrow({ where: { id: planId } })).plan,
    );

    assert.deepEqual(
      plan.commands.map((command) => command.command).sort(),
      ["help", "start"],
    );
    // Salomlashuv `/start` javobidan olinadi.
    assert.equal(plan.welcomeMessage, "Salom! Bu manba bot.");
  });

  test("5. profil va AI sozlamasi ko'chgan, nom esa yangi", async () => {
    const plan = blueprintSchema.parse(
      (await prisma.botBlueprint.findUniqueOrThrow({ where: { id: planId } })).plan,
    );

    assert.equal(plan.name, "Nusxa bot");
    assert.notEqual(plan.name, "Manba bot", "nom manbadan farq qilishi kerak");
    assert.equal(plan.businessKind, "education");
    assert.deepEqual(plan.features.sort(), ["analytics", "courses"]);
    assert.equal(plan.ai.enabled, true);
    assert.equal(plan.ai.systemPrompt, "Siz o'qituvchi yordamchisisiz.");
  });
});

describe("Nusxalash — token va sirlar KO'CHMAYDI", () => {
  test("6. rejada token yoki sir umuman yo'q", async () => {
    const draft = await prisma.botBlueprint.findUniqueOrThrow({
      where: { id: planId },
    });
    const dump = JSON.stringify(draft.plan);

    assert.ok(!dump.includes(SOURCE_TOKEN), "rejada manba tokeni topildi");
    assert.ok(!dump.includes("secret-"), "rejada webhook siri topildi");
    // Telegram identifikatori ham ko'chmasligi kerak.
    assert.ok(!dump.includes(`dup-${TAG}`), "rejada telegramBotId topildi");
  });

  test("7. nusxadan yangi bot yozuvi hosil BO'LMAYDI", async () => {
    // Butun mohiyat shu: nusxalash jonli bot yaratmaydi, faqat qoralama.
    const bots = await prisma.telegramBot.findMany({ where: { workspaceId } });
    assert.equal(bots.length, 1, "nusxalash ikkinchi bot yozuvini yaratdi");
    assert.equal(bots[0].id, botId);
  });

  test("8. manba botning tokeni buzilmagan", async () => {
    assert.equal(await readSecret(botId, "telegram_token"), SOURCE_TOKEN);
  });

  test("9. yangi qoralama uchun sir yozuvi yaratilmagan", async () => {
    const secrets = await prisma.telegramBotSecret.findMany({
      where: { botId },
    });
    assert.equal(secrets.length, 1, "kutilgan: faqat manba botning tokeni");
  });
});

describe("Nusxalash — ijarachilik", () => {
  test("10. BEGONA workspace nusxa ola olmaydi", async () => {
    await assert.rejects(
      () =>
        duplicateBotConfig(botId, {
          workspaceId: foreignWorkspaceId,
          actorId: userId,
        }),
      (error: unknown) =>
        error instanceof BotServiceError && error.status === 404,
      "begona workspace boshqa botdan nusxa oldi",
    );
  });

  test("11. begona workspace'da qoralama paydo bo'lmagan", async () => {
    const drafts = await prisma.botBlueprint.findMany({
      where: { workspaceId: foreignWorkspaceId },
    });
    assert.deepEqual(drafts, []);
  });
});

describe("Nusxalash — chuqur menyu ogohlantiriladi", () => {
  test("12. uchinchi qatlam tushib qolsa sanaladi", async () => {
    const python = await prisma.telegramBotButton.findFirstOrThrow({
      where: { botId, text: "Python" },
    });
    await prisma.telegramBotButton.create({
      data: {
        botId,
        parentId: python.id,
        text: "1-dars",
        actionType: "send_message",
        actionConfig: { text: "Birinchi dars." },
        sortOrder: 0,
      },
    });

    const result = await duplicateBotConfig(botId, scope());
    assert.equal(result.droppedDeeper, 1, "tushib qolgan shox sanalmadi");

    const plan = blueprintSchema.parse(
      (await prisma.botBlueprint.findUniqueOrThrow({ where: { id: result.planId } }))
        .plan,
    );
    // Nomi berilmasa «(nusxa)» qo'shiladi — ro'yxatda ikkita bir xil nom turmasin.
    assert.match(plan.name, /nusxa/i);
  });
});
