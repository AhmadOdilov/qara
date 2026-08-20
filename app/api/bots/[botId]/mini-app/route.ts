import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { botScope, guardWorkspace } from "@/lib/workspace";
import { BotServiceError } from "@/lib/bots/service";
import {
  createMiniApp,
  deleteMiniApp,
  loadBuilderState,
  miniAppHostingAvailable,
  updateMiniApp,
} from "@/lib/mini-app/service";
import { settingsSchema, themeSchema } from "@/lib/mini-app/schema";

type Params = { params: Promise<{ botId: string }> };

const createSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  theme: themeSchema.optional(),
  settings: settingsSchema.optional(),
});

/**
 * Konstruktor uchun to'liq holat.
 *
 * Mini App hali yaratilmagan bo'lsa `app: null` qaytadi — bu xato emas,
 * UI shu holatda «Create Mini App» ekranini ko'rsatadi.
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:read" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    const state = await loadBuilderState(botId, botScope(auth.ctx));
    if (!state) {
      return ok({ app: null, hostingAvailable: miniAppHostingAvailable() });
    }
    return ok(state);
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Yangi Mini App — bo'sh «Bosh sahifa» bilan birga keladi. */
export async function POST(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, createSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const app = await createMiniApp(botId, botScope(auth.ctx), parsed.data);
    return ok({ app: { id: app.id, name: app.name, status: app.status } }, { status: 201 });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

/** Nom, mavzu va sozlamalar. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  const parsed = await parseBody(request, patchSchema);
  if ("response" in parsed) return parsed.response;

  if (Object.keys(parsed.data).length === 0) {
    return fail("O'zgartirish uchun maydon berilmadi", 400);
  }

  try {
    const app = await updateMiniApp(botId, botScope(auth.ctx), parsed.data);
    return ok({ app: { id: app.id, name: app.name, status: app.status } });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await guardWorkspace(request, { capability: "bot:edit" });
  if ("response" in auth) return auth.response;
  const { botId } = await params;

  try {
    await deleteMiniApp(botId, botScope(auth.ctx));
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof BotServiceError) return fail(error.message, error.status);
    throw error;
  }
}
