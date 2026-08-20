import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Blueprint, BlueprintMenuItem } from "@/lib/ai/blueprint";
import type { ButtonSeed } from "@/lib/bots/buttons/templates";
import { insertSeeds, publishButtons } from "@/lib/bots/buttons/store";
import { syncCommands } from "@/lib/bots/service";
import { audit } from "@/lib/bots/audit";

/**
 * Rejani haqiqiy botga qo'llash (§7 → §47).
 *
 * Reja — deklarativ konfiguratsiya, shuning uchun qo'llash ham oddiy yozuv:
 * hech qanday kod generatsiya qilinmaydi va bajarilmaydi (§60).
 *
 * Ketma-ketlik ahamiyatli: avval qoralama tugmalar yoziladi, so'ng nashr
 * etiladi. Shunda jonli bot hech qachon yarim tayyor menyuni ko'rmaydi.
 */

function toSeed(item: BlueprintMenuItem): ButtonSeed {
  return {
    text: item.text,
    emoji: item.emoji || undefined,
    actionType: item.actionType,
    buttonType: item.actionType === "submenu" ? "submenu" : undefined,
    config: item.reply ? { text: item.reply } : undefined,
    children: item.children.map((child) => ({
      text: child.text,
      emoji: child.emoji || undefined,
      actionType: child.actionType,
      config: child.reply ? { text: child.reply } : undefined,
    })),
  };
}

export async function applyBlueprint(input: {
  botId: string;
  blueprint: Blueprint;
  actorId: string;
}): Promise<{ buttonsCreated: number; version: number }> {
  const { botId, blueprint, actorId } = input;

  // 1. Bot profili — reja bergan nom, tavsif va kategoriya.
  await prisma.telegramBot.update({
    where: { id: botId },
    data: {
      name: blueprint.name,
      description: blueprint.description || null,
      shortDescription: blueprint.shortDescription || null,
      category: blueprint.businessKind,
      features: blueprint.features,
    },
  });

  // 2. Buyruqlar: `createBot` qo'ygan standartlar reja bilan almashtiriladi.
  await prisma.telegramBotCommand.deleteMany({ where: { botId } });
  await prisma.telegramBotCommand.createMany({
    data: blueprint.commands.map((command, index) => ({
      botId,
      command: command.command,
      description: command.description,
      actionType: "send_message",
      actionConfig: { text: command.reply } as Prisma.InputJsonValue,
      sortOrder: index,
    })),
  });

  // 3. Menyu. Qoralama bo'sh bo'lishi kerak (bot endi yaratilgan), lekin
  //    qayta qo'llashda takrorlanmasligi uchun avval tozalaymiz.
  await prisma.telegramBotButton.deleteMany({ where: { botId } });
  const buttonsCreated = await insertSeeds(botId, blueprint.menu.map(toSeed));

  // 4. AI sozlamalari. Kalit yo'q bo'lsa ham prompt saqlanadi — kalit
  //    qo'shilgan zahoti bot ishlay boshlaydi, qayta sozlash shart emas.
  await prisma.telegramBotAiConfig.upsert({
    where: { botId },
    create: {
      botId,
      enabled: blueprint.ai.enabled,
      systemPrompt: blueprint.ai.systemPrompt,
      personality: blueprint.ai.personality,
      toolWebSearch: blueprint.ai.webSearch,
      toolKnowledge: blueprint.ai.knowledgeBase,
    },
    update: {
      enabled: blueprint.ai.enabled,
      systemPrompt: blueprint.ai.systemPrompt,
      personality: blueprint.ai.personality,
      toolWebSearch: blueprint.ai.webSearch,
      toolKnowledge: blueprint.ai.knowledgeBase,
    },
  });

  if (blueprint.ai.webSearch) {
    await prisma.telegramBotWebSearch.upsert({
      where: { botId },
      // `enabled: false` — provayder hali ulanmagan, ochiq sozlanmagan holat.
      create: { botId, enabled: false },
      update: {},
    });
  }

  // 5. Buyruqlarni Telegram menyusiga yozamiz va tugmalarni nashr etamiz.
  await syncCommands(botId);
  const { version } = await publishButtons(botId, actorId);

  await audit("BOT_UPDATED", {
    botId,
    actorId,
    metadata: {
      via: "blueprint",
      buttons: buttonsCreated,
      commands: blueprint.commands.length,
      features: blueprint.features.length,
    },
  });

  return { buttonsCreated, version };
}
