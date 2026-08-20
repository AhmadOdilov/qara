import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordEvent } from "@/lib/bots/audit";
import type { BotTransport } from "@/lib/bots/transport";
import { executeAction, type ActionResult, type CartDirective } from "@/lib/bots/buttons/actions";
import { NAV, parseCallback, type ParsedCallback } from "@/lib/bots/buttons/callback";
import {
  addToCart,
  cartCount,
  cartTotal,
  decFromCart,
  formatMoney,
  readCart,
  removeFromCart,
  resolveCart,
  EMPTY_CART,
  type Cart,
} from "@/lib/bots/buttons/cart";
import { isBackLabel, isHomeLabel } from "@/lib/bots/buttons/compiler";
import {
  readFavorites,
  toggleFavorite,
  type Favorites,
} from "@/lib/bots/buttons/favorites";
import {
  backTargetFor,
  backView,
  cartView,
  favoritesView,
  fallbackView,
  helpView,
  menuView,
  ordersView,
  orderView,
  productView,
  profileView,
  rootView,
  sanitizeStack,
  settingsView,
  type View,
  type ViewRequest,
} from "@/lib/bots/buttons/navigation";
import { readOrderItems, type OrderRecord } from "@/lib/bots/buttons/orders";
import { loadPublished } from "@/lib/bots/buttons/store";
import { botText } from "@/lib/bots/buttons/strings";
import {
  buttonLabel,
  DEFAULT_CURRENCY,
  needsOrders,
  type ButtonRecord,
} from "@/lib/bots/buttons/types";
import { isVisibleTo, type ViewerContext } from "@/lib/bots/buttons/visibility";

/**
 * ButtonCallbackRouter — Telegram'dan kelgan bosishni tegishli ekranga ulaydi.
 *
 * Xavfsizlik qoidasi: `callback_data` dan hech qachon AMAL olinmaydi. Undan
 * faqat ko'rsatgich o'qiladi, amal esa nashr etilgan daraxtdagi tugma
 * yozuvidan olinadi va ko'rinish qoidalari har bosishda qaytadan tekshiriladi.
 * Shu sababli foydalanuvchi payload'ni qo'lda yasab ruxsatsiz amalni chaqira
 * olmaydi (§11, §17). Buyurtmalar ham shu qoidada: `ord:one:<kod>` bosilganda
 * yozuv `botId` VA `telegramUserId` bo'yicha izlanadi — begona buyurtma
 * raqamini yozib ko'rish natija bermaydi.
 *
 * Navigatsiya imkon boricha mavjud xabarni tahrirlaydi (§10): ichma-ich
 * menyuda foydalanuvchi bitta «ekran»da yuradi, chat yangi xabarlar bilan
 * to'lib ketmaydi.
 */

export type RouterContext = {
  botId: string;
  botUserId: string;
  chatId: string;
  telegramUserId: string;
  transport: BotTransport;
  viewer: ViewerContext;
  /// Bot egasi sozlagan reply klaviatura parametrlari
  replyOptions: Record<string, unknown>;
  /// Callback kelgan xabar — joyida tahrirlash uchun
  messageId?: number;
  /// Ildiz menyusi sarlavhasi (`/start` javobi)
  rootText?: string;
};

type PendingState = {
  menu?: string[];
  collect?: { collect: "name" | "email"; buttonId: string } | null;
  /**
   * Ma'lumot olingandan keyin qaysi ekranga qaytiladi.
   *
   * Sozlamalardan kirilgan ism yoki telefon saqlangach foydalanuvchini
   * menyuga otib tashlash o'rniga profilga qaytaramiz — u aynan shu yerdan
   * kelgan (§9).
   */
  after?: "profile";
};

/** Foydalanuvchining bir marta o'qiladigan holati: savatcha va sevimlilar. */
type UserData = {
  cart: Cart;
  favorites: Favorites;
  firstName: string | null;
};

function request(ctx: RouterContext, data?: Partial<UserData>): ViewRequest {
  return {
    viewer: ctx.viewer,
    replyOptions: ctx.replyOptions,
    ...(data?.cart ? { cart: data.cart } : {}),
    ...(data?.favorites ? { favorites: data.favorites } : {}),
    ...(ctx.rootText ? { rootText: ctx.rootText } : {}),
  };
}

/* ── Kirish nuqtalari ────────────────────────────────────────────────────── */

/**
 * Inline tugma bosilishi (`callback_query`).
 *
 * Callback oynasi oxirida bir marta yopiladi — shu bilan «yuklanmoqda»
 * holatida qolib ketmaydi va kerak bo'lsa qisqa bildirishnoma ham chiqadi.
 */
export async function routeCallback(
  ctx: RouterContext,
  callbackQueryId: string,
  data: string,
): Promise<boolean> {
  let answered = false;
  const answer = async (text?: string) => {
    if (answered) return;
    answered = true;
    await ctx.transport.answerCallback(callbackQueryId, text);
  };

  try {
    const parsed = parseCallback(data);

    if (parsed.kind === "language") {
      await setLanguage(ctx, parsed.lang);
      return true;
    }

    const buttons = await loadPublished(ctx.botId);
    const state = await readState(ctx.botUserId);
    const stack = sanitizeStack(buttons, state.menu ?? []);
    /// Tizim ekranlari qaysi menyudan ochilgani — «orqaga» shu yerga qaytadi
    const from = stack[stack.length - 1] ?? null;

    switch (parsed.kind) {
      case "home": {
        await show(ctx, rootView(buttons, request(ctx)), { menu: [], collect: null });
        return true;
      }

      case "back": {
        const result = backView(buttons, parsed.menu, stack, request(ctx));
        await show(ctx, result.view, { menu: result.stack, collect: null });
        return true;
      }

      case "cart_add": {
        await answer(await addProduct(ctx, buttons, parsed.product, parsed.then, stack));
        return true;
      }

      case "cart_qty": {
        const toast = await changeQty(ctx, buttons, parsed, stack, from);
        await answer(toast);
        return true;
      }

      case "cart_open": {
        const user = await readUserData(ctx);
        await show(ctx, cartView(buttons, user.cart, from, request(ctx, user)), {
          menu: stack,
          collect: null,
        });
        return true;
      }

      case "cart_clear": {
        await writeCart(ctx, EMPTY_CART);
        await show(ctx, cartView(buttons, EMPTY_CART, from, request(ctx)), {
          menu: stack,
          collect: null,
        });
        await answer(botText(ctx.viewer.languageCode, "cartCleared"));
        return true;
      }

      case "cart_checkout": {
        await placeOrder(ctx, buttons, stack);
        return true;
      }

      case "favorite_toggle": {
        await answer(await switchFavorite(ctx, buttons, parsed.product, stack));
        return true;
      }

      case "favorites": {
        const user = await readUserData(ctx);
        await show(
          ctx,
          favoritesView(buttons, user.favorites, from, request(ctx, user)),
          { menu: stack, collect: null },
        );
        return true;
      }

      case "favorites_clear": {
        await mergeVariables(ctx, { favorites: [] });
        await show(ctx, favoritesView(buttons, [], from, request(ctx)), {
          menu: stack,
          collect: null,
        });
        await answer(botText(ctx.viewer.languageCode, "favoritesCleared"));
        return true;
      }

      case "orders": {
        // Bazadan o'qish sekin bo'lishi mumkin — Telegram tugmadagi
        // aylanani ko'rsatib turadi, biz esa «yozmoqda» belgisini qo'shamiz.
        await ctx.transport.typing(ctx.chatId).catch(() => undefined);
        const orders = await readOrders(ctx);
        await show(ctx, ordersView(buttons, orders, from, request(ctx)), {
          menu: stack,
          collect: null,
        });
        return true;
      }

      case "order": {
        const order = await readOrder(ctx, parsed.code);
        const view = order
          ? orderView(order, request(ctx))
          : fallbackView("orderGone", request(ctx), from);
        await show(ctx, view, { menu: stack, collect: null });
        return true;
      }

      case "profile": {
        const user = await readUserData(ctx);
        await show(ctx, profileView(user.firstName, from, request(ctx, user)), {
          menu: stack,
          collect: null,
        });
        return true;
      }

      case "settings": {
        await show(ctx, settingsView(request(ctx)), { menu: stack, collect: null });
        return true;
      }

      case "set_name": {
        await askForName(ctx, stack);
        return true;
      }

      case "share_phone": {
        await askForPhone(ctx, stack);
        return true;
      }

      case "help": {
        await show(ctx, helpView(null, from, request(ctx)), {
          menu: stack,
          collect: null,
        });
        return true;
      }

      default: {
        const button = buttons.find((candidate) => candidate.callbackId === parsed.id);

        // Nashrdan chiqib ketgan tugma: foydalanuvchi eski xabardagi tugmani
        // bosgan bo'lishi mumkin — jim qolmaymiz, chiqish yo'li beramiz (§15).
        if (!button) {
          await show(ctx, fallbackView("staleButton", request(ctx)), {
            menu: [],
            collect: null,
          });
          await answer(botText(ctx.viewer.languageCode, "staleButton"));
          return true;
        }

        // Ruxsat har bosishda qaytadan tekshiriladi (§17): yashirin yoki
        // admin tugmasini callback yuborish orqali ishlatib bo'lmaydi.
        if (!isVisibleTo(button, ctx.viewer)) {
          await answer(botText(ctx.viewer.languageCode, "notAllowed"));
          return true;
        }

        const result = await runButton(ctx, button, buttons, stack);
        await answer(result.toast);
        return true;
      }
    }
  } finally {
    // Amal qulasa ham callback oynasi yopilishi kerak — aks holda tugma
    // Telegram'da «yuklanmoqda» holatida qotib qolardi.
    await answer();
  }
}

/** Reply klaviaturasidagi tugma — Telegram uni oddiy matn sifatida yuboradi. */
export async function routeText(ctx: RouterContext, text: string): Promise<boolean> {
  const buttons = await loadPublished(ctx.botId);
  const state = await readState(ctx.botUserId);
  const stack = sanitizeStack(buttons, state.menu ?? []);
  const menuId = stack[stack.length - 1] ?? null;

  // Yorliq uch tilda ham, eski shaklda ham tanilishi kerak: chatdagi
  // klaviatura til almashtirilgandan keyin ham ishlab turadi.
  if (isBackLabel(text)) {
    const result = backView(buttons, undefined, stack, request(ctx));
    await show(ctx, result.view, { menu: result.stack, collect: null });
    return true;
  }

  if (isHomeLabel(text)) {
    await show(ctx, rootView(buttons, request(ctx)), { menu: [], collect: null });
    return true;
  }

  // Avval hozirgi menyu ichidan izlaymiz: ichma-ich menyularda bir xil
  // yorliqli tugmalar bo'lishi tabiiy («Narxlar» har bo'limda uchraydi).
  const button =
    findReplyButton(buttons, text, menuId) ?? findReplyButton(buttons, text, undefined);
  if (!button || !isVisibleTo(button, ctx.viewer)) return false;

  await runButton(ctx, button, buttons, stack);
  return true;
}

function findReplyButton(
  buttons: ButtonRecord[],
  text: string,
  menuId: string | null | undefined,
): ButtonRecord | undefined {
  return buttons.find(
    (button) =>
      button.keyboardKind === "reply" &&
      (menuId === undefined || button.parentId === menuId) &&
      (buttonLabel(button) === text || button.text === text),
  );
}

/**
 * Foydalanuvchi ismi/emailini kutayotgan holat.
 * `collect_name` va `collect_email` amallaridan keyingi xabar shu yerga tushadi.
 */
export async function routePendingInput(
  ctx: RouterContext,
  text: string,
): Promise<boolean> {
  const state = await readState(ctx.botUserId);
  const pending = state.collect;
  if (!pending) return false;

  // Buyruq — javob emas. Foydalanuvchi `/start` yozib chiqib keta olishi kerak,
  // aks holda buyruqning o'zi ism bo'lib saqlanib qolardi. Kutish holatini
  // bo'shatamiz va buyruq o'z yo'li bilan ketsin.
  if (text.startsWith("/")) {
    await writeState(ctx.botUserId, { menu: state.menu ?? [], collect: null });
    return false;
  }

  const lang = ctx.viewer.languageCode;

  if (pending.collect === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
    // Holat saqlanadi: foydalanuvchi qaytadan yozishi kerak, boshqa ekranga
    // otib tashlash uni chalkashtirardi.
    await ctx.transport.send(ctx.chatId, botText(lang, "invalidEmail"), {});
    return true;
  }

  await prisma.telegramBotUser.update({
    where: { id: ctx.botUserId },
    data: {
      ...(pending.collect === "name" ? { firstName: text.slice(0, 64) } : {}),
      ...(pending.collect === "email" ? { email: text.slice(0, 160) } : {}),
    },
  });

  const buttons = await loadPublished(ctx.botId);
  const stack = sanitizeStack(buttons, state.menu ?? []);
  const view = await afterSaveView(ctx, buttons, stack, state.after);

  await ctx.transport.send(ctx.chatId, `${botText(lang, "saved")}\n\n${view.text}`, {
    replyMarkup: view.markup,
  });
  await writeState(ctx.botUserId, { menu: stack, collect: null });
  return true;
}

/**
 * Ma'lumot saqlangandan keyingi ekran.
 *
 * Sozlamalardan kelgan bo'lsa — profil (yangi qiymat darhol ko'rinadi), aks
 * holda foydalanuvchi turgan menyu.
 */
async function afterSaveView(
  ctx: RouterContext,
  buttons: ButtonRecord[],
  stack: string[],
  after: PendingState["after"],
): Promise<View> {
  const menuId = stack[stack.length - 1] ?? null;
  if (after === "profile") {
    const data = await readUserData(ctx);
    return profileView(data.firstName, menuId, request(ctx, data));
  }
  return menuView(buttons, menuId, backTargetFor(buttons, menuId), request(ctx));
}

/** `request_contact` / `request_location` javoblari. */
export async function routeSharedData(
  ctx: RouterContext,
  shared: { phone?: string; latitude?: number; longitude?: number },
): Promise<void> {
  if (shared.phone) {
    await prisma.telegramBotUser.update({
      where: { id: ctx.botUserId },
      data: { phone: shared.phone.slice(0, 32) },
    });
  }
  if (shared.latitude !== undefined && shared.longitude !== undefined) {
    await mergeVariables(ctx, {
      latitude: shared.latitude,
      longitude: shared.longitude,
    });
  }

  const buttons = await loadPublished(ctx.botId);
  const state = await readState(ctx.botUserId);
  const stack = sanitizeStack(buttons, state.menu ?? []);
  // Telefon sozlamalardan so'ralgan bo'lsa — profilga qaytamiz va yangi
  // raqam darhol ko'rinadi.
  const view = await afterSaveView(ctx, buttons, stack, state.after);

  await ctx.transport.send(
    ctx.chatId,
    `${botText(ctx.viewer.languageCode, "saved")}\n\n${view.text}`,
    { replyMarkup: view.markup },
  );
  await writeState(ctx.botUserId, { menu: stack, collect: null });
}

/** Ildiz menyusini ko'rsatish — `/start` va shunga o'xshash joylardan. */
export async function sendRootMenu(ctx: RouterContext, text: string): Promise<boolean> {
  const buttons = await loadPublished(ctx.botId);
  const view = rootView(buttons, { ...request(ctx), rootText: text });
  if (view.visible.length === 0) return false;

  // `/start` doim yangi xabar: foydalanuvchi suhbatni boshidan boshlaydi.
  await ctx.transport.send(ctx.chatId, view.text, { replyMarkup: view.markup });
  await writeState(ctx.botUserId, { menu: [], collect: null });
  await recordShown(ctx, view.visible);
  return true;
}

/**
 * Buyruq bilan ochiladigan tizim ekrani (`/cart`, `/orders`, `/profile`,
 * `/help`) — daraxtda tugma bo'lmasa ham ishlaydi (§21).
 */
export async function sendScreen(
  ctx: RouterContext,
  screen: "cart" | "orders" | "favorites" | "profile" | "help",
  helpText?: string,
): Promise<void> {
  const buttons = await loadPublished(ctx.botId);
  const data = await readUserData(ctx);
  const req = request(ctx, data);

  const view =
    screen === "cart"
      ? cartView(buttons, data.cart, null, req)
      : screen === "favorites"
        ? favoritesView(buttons, data.favorites, null, req)
        : screen === "orders"
          ? ordersView(buttons, await readOrders(ctx), null, req)
          : screen === "profile"
            ? profileView(data.firstName, null, req)
            : helpView(helpText ?? null, null, req);

  await ctx.transport.send(ctx.chatId, view.text, { replyMarkup: view.markup });
  await writeState(ctx.botUserId, { menu: [], collect: null });
}

/* ── Amalni bajarish ─────────────────────────────────────────────────────── */

async function runButton(
  ctx: RouterContext,
  button: ButtonRecord,
  buttons: ButtonRecord[],
  stack: string[],
): Promise<ActionResult> {
  const started = Date.now();
  await recordClick(ctx, button);

  const data = await readUserData(ctx);

  const result = await executeAction({
    button,
    allButtons: buttons,
    viewer: ctx.viewer,
    menuStack: stack,
    replyOptions: ctx.replyOptions,
    lang: ctx.viewer.languageCode,
    cart: data.cart,
    favorites: data.favorites,
    viewerName: data.firstName,
    // Buyurtmalar faqat kerak bo'lganda o'qiladi: har bosishda bazaga
    // qo'shimcha so'rov yuborishning ma'nosi yo'q.
    ...(needsOrders(button.actionType) ? { orders: await readOrders(ctx) } : {}),
    ...(ctx.rootText ? { rootText: ctx.rootText } : {}),
  });

  if (result.typing) {
    await ctx.transport.typing(ctx.chatId).catch(() => undefined);
  }

  const applied = await applyCart(ctx, result);
  // Savatcha to'lgan bo'lsa handler tayyorlagan «qo'shildi» bildirishnomasi
  // to'g'ri kelmaydi — direktivani bajargan qatlam uni almashtira oladi.
  if (applied.toast) result.toast = applied.toast;

  await deliver(ctx, {
    text: applied.text,
    markup: result.markup,
    editable: result.editable ?? false,
    silent: result.silent,
  });

  await writeState(ctx.botUserId, {
    menu: result.menuStack ?? stack,
    collect: result.pendingState ?? null,
  });

  await recordEvent(ctx.botId, "tool_call", `button:${button.actionType}`, {
    ok: result.ok,
    latencyMs: Date.now() - started,
    detail: { buttonId: button.id },
  });

  await prisma.telegramBotButtonEvent
    .create({
      data: {
        botId: ctx.botId,
        buttonId: button.id,
        telegramUserId: ctx.telegramUserId,
        eventType: result.ok ? "action_ok" : "action_error",
      },
    })
    .catch(() => undefined);

  return result;
}

/**
 * Ekranni yetkazish.
 *
 * Inline klaviatura bo'lsa mavjud xabar tahrirlanadi; tahrirlash imkonsiz
 * bo'lsa (xabar o'chirilgan yoki juda eski) yangi xabar yuboriladi — ikki
 * holatda ham foydalanuvchi natijani ko'radi.
 */
async function deliver(
  ctx: RouterContext,
  payload: { text: string; markup?: unknown; editable: boolean; silent?: boolean },
): Promise<void> {
  const inline = isInlineMarkup(payload.markup);

  if (payload.editable && inline && ctx.messageId !== undefined) {
    const outcome = await ctx.transport.edit(ctx.chatId, ctx.messageId, payload.text, {
      replyMarkup: payload.markup,
    });
    if (outcome !== "unavailable") return;
  }

  await ctx.transport.send(ctx.chatId, payload.text, {
    replyMarkup: payload.markup,
    silent: payload.silent,
  });
}

function isInlineMarkup(markup: unknown): boolean {
  return Boolean(markup && typeof markup === "object" && "inline_keyboard" in markup);
}

/** Menyu ekranini ko'rsatadi va holatni yozadi. */
async function show(
  ctx: RouterContext,
  view: View,
  state: PendingState,
): Promise<void> {
  await deliver(ctx, { text: view.text, markup: view.markup, editable: view.editable });
  await writeState(ctx.botUserId, state);
  if (view.visible.length > 0) await recordShown(ctx, view.visible);
}

/* ── Savatcha (§6) ───────────────────────────────────────────────────────── */

async function readUserData(ctx: RouterContext): Promise<UserData> {
  const row = await prisma.telegramBotUser.findUnique({
    where: { id: ctx.botUserId },
    select: { variables: true, firstName: true },
  });
  return {
    cart: readCart(row?.variables),
    favorites: readFavorites(row?.variables),
    firstName: row?.firstName ?? null,
  };
}

async function writeCart(ctx: RouterContext, cart: Cart): Promise<void> {
  await mergeVariables(ctx, { cart });
}

/** `variables` ni butunlay qayta yozmasdan, faqat kerakli kalitlarni yangilaydi. */
async function mergeVariables(
  ctx: RouterContext,
  patch: Record<string, unknown>,
): Promise<void> {
  const row = await prisma.telegramBotUser.findUnique({
    where: { id: ctx.botUserId },
    select: { variables: true },
  });
  await prisma.telegramBotUser.update({
    where: { id: ctx.botUserId },
    data: {
      variables: {
        ...((row?.variables ?? {}) as Record<string, unknown>),
        ...patch,
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Handler qaytargan savatcha direktivasini bajaradi.
 *
 * Buyurtma yozuvi shu yerda yaratiladi — summa handlerdagi sof hisobdan
 * keladi, klientdan yoki callback'dan emas (§17).
 */
async function applyCart(
  ctx: RouterContext,
  result: ActionResult,
): Promise<{ text: string; toast?: string }> {
  const directive: CartDirective | undefined = result.cart;
  if (!directive) return { text: result.text };

  if (directive.op === "add") {
    const data = await readUserData(ctx);
    const cart = addToCart(data.cart, directive.productId);
    await writeCart(ctx, cart);
    // Savatcha to'lgan bo'lsa qator qo'shilmaydi — buni yashirmaymiz.
    return cartCount(cart) > cartCount(data.cart)
      ? { text: result.text }
      : { text: result.text, toast: botText(ctx.viewer.languageCode, "cartFull") };
  }

  if (directive.op === "clear") {
    await writeCart(ctx, EMPTY_CART);
    return { text: result.text };
  }

  const order = await createOrder(ctx, directive);
  await writeCart(ctx, EMPTY_CART);
  return {
    text: botText(ctx.viewer.languageCode, "orderPlaced", {
      order,
      total: formatMoney(directive.total, directive.currency),
    }),
  };
}

async function createOrder(
  ctx: RouterContext,
  directive: Extract<CartDirective, { op: "checkout" }>,
): Promise<string> {
  const payment = await prisma.telegramBotPayment.create({
    data: {
      botId: ctx.botId,
      telegramUserId: ctx.telegramUserId,
      amount: Math.round(directive.total),
      currency: directive.currency,
      status: "pending",
      payload: { items: directive.items } as Prisma.InputJsonValue,
    },
  });

  // Foydalanuvchiga ko'rsatiladigan qisqa raqam — id'ning oxiri, sir emas.
  const code = payment.id.slice(-6).toUpperCase();
  await prisma.telegramBotPayment.update({
    where: { id: payment.id },
    data: { orderId: code },
  });
  return code;
}

/**
 * Mahsulot kartasidagi «savatchaga qo'shish» / «hozir sotib olish».
 *
 * Callback oynasida ko'rsatiladigan matnni qaytaradi. Savatcha to'lgan bo'lsa
 * `addToCart` o'zgarishsiz savatni qaytaradi — bunda «qo'shildi» deb yozish
 * yolg'on bo'lardi, shuning uchun sabab ochiq aytiladi.
 */
async function addProduct(
  ctx: RouterContext,
  buttons: ButtonRecord[],
  productCallbackId: string,
  then: "stay" | "cart",
  stack: string[],
): Promise<string | undefined> {
  const lang = ctx.viewer.languageCode;
  const product = findProduct(buttons, productCallbackId);

  if (!product || !isVisibleTo(product, ctx.viewer)) {
    await show(ctx, fallbackView("staleButton", request(ctx)), { menu: [], collect: null });
    return botText(lang, "staleButton");
  }

  const data = await readUserData(ctx);
  const cart = addToCart(data.cart, product.id);
  const added = cartCount(cart) > cartCount(data.cart);
  await writeCart(ctx, cart);
  await recordClick(ctx, product);

  const req = request(ctx, { ...data, cart });
  const view =
    then === "cart"
      ? cartView(buttons, cart, product.parentId, req)
      : productView(buttons, product, req);

  await show(ctx, view, { menu: stack, collect: null });
  return botText(lang, added ? "addedToCart" : "cartFull");
}

/**
 * Savatchadagi miqdorni o'zgartirish (➖ / ➕ / 🗑).
 *
 * Foydalanuvchi bosgan ekranida qoladi: savatcha ro'yxatida bo'lsa ro'yxat,
 * mahsulot kartasida bo'lsa karta qaytadan chiziladi.
 */
async function changeQty(
  ctx: RouterContext,
  buttons: ButtonRecord[],
  parsed: Extract<ParsedCallback, { kind: "cart_qty" }>,
  stack: string[],
  from: string | null,
): Promise<string | undefined> {
  const lang = ctx.viewer.languageCode;
  const product = findProduct(buttons, parsed.product);

  if (!product || !isVisibleTo(product, ctx.viewer)) {
    await show(ctx, fallbackView("staleButton", request(ctx), from), {
      menu: stack,
      collect: null,
    });
    return botText(lang, "staleButton");
  }

  const data = await readUserData(ctx);
  const cart =
    parsed.op === "inc"
      ? addToCart(data.cart, product.id)
      : parsed.op === "dec"
        ? decFromCart(data.cart, product.id)
        : removeFromCart(data.cart, product.id);

  await writeCart(ctx, cart);

  const req = request(ctx, { ...data, cart });
  const view =
    parsed.then === "product"
      ? productView(buttons, product, req)
      : cartView(buttons, cart, from, req);

  await show(ctx, view, { menu: stack, collect: null });

  if (parsed.op === "inc") return botText(lang, "addedToCart");
  return botText(lang, "removedFromCart");
}

/** Savatcha ekranidagi «buyurtma berish». */
async function placeOrder(
  ctx: RouterContext,
  buttons: ButtonRecord[],
  stack: string[],
): Promise<void> {
  const data = await readUserData(ctx);
  const lines = resolveCart(buttons, data.cart);
  const menuId = stack[stack.length - 1] ?? null;

  if (lines.length === 0) {
    await show(ctx, cartView(buttons, data.cart, menuId, request(ctx, data)), {
      menu: stack,
      collect: null,
    });
    return;
  }

  await ctx.transport.typing(ctx.chatId).catch(() => undefined);

  const total = cartTotal(lines);
  const currency = lines[0]?.config.currency?.trim() || DEFAULT_CURRENCY;
  const order = await createOrder(ctx, {
    op: "checkout",
    total,
    currency,
    items: lines.map((line) => ({
      productId: line.button.id,
      title: line.config.title?.trim() || line.button.text,
      qty: line.qty,
      amount: line.amount,
    })),
  });
  await writeCart(ctx, EMPTY_CART);

  // Tasdiq xabari buyurtmalar ro'yxatiga yo'l ko'rsatadi: «buyurtmam
  // qayerda?» degan savol shu yerda hal bo'ladi.
  const orders = await readOrders(ctx);
  const view = ordersView(buttons, orders, menuId, request(ctx));

  await deliver(ctx, {
    text: botText(ctx.viewer.languageCode, "orderPlaced", {
      order,
      total: formatMoney(total, currency),
    }),
    markup: view.markup,
    editable: true,
  });
  await writeState(ctx.botUserId, { menu: stack, collect: null });
}

function findProduct(
  buttons: ButtonRecord[],
  callbackId: string,
): ButtonRecord | undefined {
  return buttons.find(
    (button) => button.callbackId === callbackId && button.actionType === "product",
  );
}

/* ── Sevimlilar ──────────────────────────────────────────────────────────── */

async function switchFavorite(
  ctx: RouterContext,
  buttons: ButtonRecord[],
  productCallbackId: string,
  stack: string[],
): Promise<string> {
  const lang = ctx.viewer.languageCode;
  const product = findProduct(buttons, productCallbackId);

  if (!product || !isVisibleTo(product, ctx.viewer)) {
    await show(ctx, fallbackView("staleButton", request(ctx)), {
      menu: stack,
      collect: null,
    });
    return botText(lang, "staleButton");
  }

  const data = await readUserData(ctx);
  const { favorites, added } = toggleFavorite(data.favorites, product.id);
  await mergeVariables(ctx, { favorites });

  await show(
    ctx,
    productView(buttons, product, request(ctx, { ...data, favorites })),
    { menu: stack, collect: null },
  );
  return botText(lang, added ? "favoriteAdded" : "favoriteRemoved");
}

/* ── Buyurtmalar (§8) ────────────────────────────────────────────────────── */

const ORDERS_LIMIT = 10;

async function readOrders(ctx: RouterContext): Promise<OrderRecord[]> {
  const rows = await prisma.telegramBotPayment.findMany({
    where: { botId: ctx.botId, telegramUserId: ctx.telegramUserId },
    orderBy: { createdAt: "desc" },
    take: ORDERS_LIMIT,
    select: {
      id: true,
      orderId: true,
      status: true,
      amount: true,
      currency: true,
      createdAt: true,
      payload: true,
    },
  });
  return rows.map(toOrder);
}

/**
 * Bitta buyurtma.
 *
 * Izlash `botId` va `telegramUserId` bilan cheklangan: boshqa odamning
 * buyurtma raqamini callback'ga yozib yuborish natija bermaydi.
 */
async function readOrder(ctx: RouterContext, code: string): Promise<OrderRecord | null> {
  const row = await prisma.telegramBotPayment.findFirst({
    where: {
      botId: ctx.botId,
      telegramUserId: ctx.telegramUserId,
      orderId: code.slice(0, 32),
    },
    select: {
      id: true,
      orderId: true,
      status: true,
      amount: true,
      currency: true,
      createdAt: true,
      payload: true,
    },
  });
  return row ? toOrder(row) : null;
}

function toOrder(row: {
  id: string;
  orderId: string | null;
  status: string;
  amount: number;
  currency: string;
  createdAt: Date;
  payload: Prisma.JsonValue;
}): OrderRecord {
  return {
    code: row.orderId ?? row.id.slice(-6).toUpperCase(),
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    createdAt: row.createdAt,
    items: readOrderItems(row.payload),
  };
}

/* ── Profil sozlamalari (§7) ─────────────────────────────────────────────── */

/** Ismni so'rash: keyingi xabar javob deb qabul qilinadi. */
async function askForName(ctx: RouterContext, stack: string[]): Promise<void> {
  const lang = ctx.viewer.languageCode;
  await deliver(ctx, {
    text: botText(lang, "askName"),
    markup: {
      inline_keyboard: [
        [{ text: botText(lang, "back"), callback_data: NAV.settings }],
      ],
    },
    editable: true,
  });
  await writeState(ctx.botUserId, {
    menu: stack,
    collect: { collect: "name", buttonId: NAV.setName },
    after: "profile",
  });
}

/**
 * Telefonni so'rash.
 *
 * Telegram raqam so'rash tugmasini faqat reply klaviaturada ko'rsatadi,
 * shuning uchun bu yerda yangi xabar yuboriladi — tahrirlash bilan
 * bo'lmaydi.
 */
async function askForPhone(ctx: RouterContext, stack: string[]): Promise<void> {
  const lang = ctx.viewer.languageCode;
  await ctx.transport.send(ctx.chatId, botText(lang, "askPhone"), {
    replyMarkup: {
      keyboard: [
        [{ text: botText(lang, "sharePhone"), request_contact: true }],
        [{ text: botText(lang, "back") }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
  await writeState(ctx.botUserId, { menu: stack, collect: null, after: "profile" });
}

/* ── Holat ───────────────────────────────────────────────────────────────── */

async function readState(botUserId: string): Promise<PendingState> {
  const row = await prisma.telegramBotUser.findUnique({
    where: { id: botUserId },
    select: { pendingState: true },
  });
  return ((row?.pendingState ?? {}) as PendingState) ?? {};
}

async function writeState(botUserId: string, state: PendingState): Promise<void> {
  await prisma.telegramBotUser
    .update({
      where: { id: botUserId },
      data: { pendingState: state as unknown as Prisma.InputJsonValue },
    })
    .catch(() => undefined);
}

async function setLanguage(ctx: RouterContext, lang: string): Promise<void> {
  await prisma.telegramBotUser.update({
    where: { id: ctx.botUserId },
    data: { languageCode: lang },
  });

  const viewer = { ...ctx.viewer, languageCode: lang };
  const buttons = await loadPublished(ctx.botId);
  const view = rootView(buttons, { ...request(ctx), viewer });
  await deliver({ ...ctx, viewer }, {
    text: view.text,
    markup: view.markup,
    editable: view.editable,
  });
  // Ekran ildizga qaytdi — tarix ham shu holatga keltiriladi, aks holda
  // keyingi «orqaga» foydalanuvchini kutilmagan joyga olib borardi.
  await writeState(ctx.botUserId, { menu: [], collect: null });
}

/* ── Analitika ───────────────────────────────────────────────────────────── */

async function recordClick(ctx: RouterContext, button: ButtonRecord): Promise<void> {
  await Promise.all([
    prisma.telegramBotButton
      .update({ where: { id: button.id }, data: { clickCount: { increment: 1 } } })
      .catch(() => undefined),
    prisma.telegramBotButtonEvent
      .create({
        data: {
          botId: ctx.botId,
          buttonId: button.id,
          telegramUserId: ctx.telegramUserId,
          eventType: "click",
        },
      })
      .catch(() => undefined),
  ]);
}

async function recordShown(ctx: RouterContext, buttons: ButtonRecord[]): Promise<void> {
  if (buttons.length === 0) return;
  await prisma.telegramBotButtonEvent
    .createMany({
      data: buttons.map((button) => ({
        botId: ctx.botId,
        buttonId: button.id,
        telegramUserId: ctx.telegramUserId,
        eventType: "shown",
      })),
    })
    .catch(() => undefined);
}

export type { ParsedCallback };
