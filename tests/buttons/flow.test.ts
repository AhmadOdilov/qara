/**
 * To'liq foydalanuvchi yo'li (§12, §21).
 *
 * Bu sinov alohida funksiyalarni emas, YO'LNI tekshiradi:
 *
 *   START → BOSH MENYU → KATEGORIYA → SUBKATEGORIYA → MAHSULOT →
 *   SAVATCHAGA QO'SHISH → SAVATCHA → BUYURTMA → ORQAGA
 *
 * Asosiy shart bitta: har bir ekranda chiqish yo'li bo'lishi kerak. Shu
 * sababli oxirida barcha ekranlar bo'yicha umumiy tekshiruv ham bor —
 * foydalanuvchi hech qachon «qayerga qaytaman?» degan holatda qolmasin.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { executeAction, type ActionContext } from "../../lib/bots/buttons/actions";
import { NAV, parseCallback } from "../../lib/bots/buttons/callback";
import { addToCart, EMPTY_CART, type Cart } from "../../lib/bots/buttons/cart";
import {
  backView,
  cartView,
  favoritesView,
  helpView,
  menuView,
  ordersView,
  productView,
  profileView,
  rootView,
  settingsView,
  type View,
} from "../../lib/bots/buttons/navigation";
import type { ButtonRecord, ReplyMarkup } from "../../lib/bots/buttons/types";
import { btn, callbacks, deepShopTree, isInline, labels, viewer } from "./helpers";

const req = { viewer: viewer() };

function press(
  tree: ButtonRecord[],
  id: string,
  overrides: Partial<ActionContext> = {},
) {
  const button = tree.find((candidate) => candidate.id === id);
  assert.ok(button, `${id} topilmadi`);
  return executeAction({
    button,
    allButtons: tree,
    viewer: viewer(),
    menuStack: [],
    replyOptions: {},
    lang: "uz",
    cart: EMPTY_CART,
    favorites: [],
    ...overrides,
  });
}

/** Ekranda qaytish yo'li bormi: «orqaga» yoki «bosh menyu». */
function hasExit(markup: ReplyMarkup): boolean {
  if (!isInline(markup)) {
    return labels(markup).some((label) => label.startsWith("⬅️") || label.startsWith("🏠"));
  }
  return callbacks(markup).some(
    (data) => data === NAV.home || data.startsWith(NAV.back) || data === NAV.profile,
  );
}

describe("to'liq xarid yo'li", () => {
  test("START dan buyurtmagacha va orqaga qaytish", async () => {
    const tree = deepShopTree();
    let stack: string[] = [];
    let cart: Cart = EMPTY_CART;

    // 1. START — ildiz menyusi. Qaytadigan joy yo'q, shuning uchun «orqaga» ham yo'q.
    const start = rootView(tree, { ...req, rootText: "👋 Assalomu alaykum!" });
    assert.equal(start.text, "👋 Assalomu alaykum!");
    assert.deepEqual(labels(start.markup), ["shop", "Savat"]);
    assert.equal(hasExit(start.markup), false, "ildizda navigatsiya kerak emas");

    // 2–5. Kategoriya → subkategoriya → ichki bo'lim (4 qatlam).
    for (const step of ["shop", "clothing", "men", "shirts"]) {
      const result = await press(tree, step, { menuStack: stack });
      assert.equal(result.ok, true, `${step} ochilmadi`);
      assert.equal(result.menuId, step);
      assert.ok(result.menuStack, `${step} tarixni yozmadi`);
      stack = result.menuStack!;
      assert.ok(hasExit(result.markup!), `${step} ekranida chiqish yo'li yo'q`);
    }
    assert.deepEqual(stack, ["shop", "clothing", "men", "shirts"]);

    // 6. Mahsulot kartasi — savatchaga qo'shish tugmasi bilan.
    const card = await press(tree, "shirt-classic", { menuStack: stack });
    assert.match(card.text, /Klassik ko'ylak/);
    assert.match(card.text, /250 000 so'm/);
    const add = callbacks(card.markup!).find((data) => data.startsWith("cart:add:"));
    assert.ok(add, "«savatchaga qo'shish» tugmasi yo'q");
    assert.equal(card.menuId, "shirts", "karta o'z bo'limida qoladi");

    // 7. Tugma bosildi — router shu ko'rsatgich bo'yicha mahsulotni topadi.
    const parsed = parseCallback(add!);
    assert.equal(parsed.kind, "cart_add");
    const product = tree.find(
      (button) => parsed.kind === "cart_add" && button.callbackId === parsed.product,
    );
    assert.ok(product, "ko'rsatgich mahsulotga olib bormadi");
    cart = addToCart(cart, product!.id);

    // 8. Karta endi miqdorni ko'rsatadi va savatchaga yo'l beradi.
    const withQty = productView(tree, product!, { ...req, cart });
    assert.ok(labels(withQty.markup).includes("🛒 Savatchada: 1 ta"));
    assert.ok(callbacks(withQty.markup).includes(NAV.cartOpen));

    // 9. Savatcha: qatorlar, jami summa, buyurtma tugmasi.
    const inCart = cartView(tree, cart, "shirts", req);
    assert.match(inCart.text, /1️⃣ Klassik ko'ylak/);
    assert.match(inCart.text, /Jami: 250 000 so'm/);
    assert.ok(callbacks(inCart.markup).includes(NAV.cartCheckout));

    // 10. Buyurtma: summa savatchadan hisoblanadi, so'ng ildizga qaytadi.
    tree.push(btn({ id: "pay", parentId: "shop", actionType: "checkout" }));
    const paid = await press(tree, "pay", { cart, menuStack: stack });
    assert.ok(paid.cart && paid.cart.op === "checkout");
    if (paid.cart?.op === "checkout") {
      assert.equal(paid.cart.total, 250_000);
      assert.deepEqual(paid.cart.items.map((line) => line.qty), [1]);
    }

    // 11. Orqaga: har bosishda bitta pog'ona yuqoriga, oxiri ildiz.
    const steps: (string | null)[] = [];
    let history = ["shop", "clothing", "men", "shirts"];
    for (let index = 0; index < 5; index += 1) {
      const back = backView(tree, undefined, history, req);
      history = back.stack;
      steps.push(back.view.menuId);
    }
    assert.deepEqual(steps, ["men", "clothing", "shop", null, null]);
  });

  test("bot qayta ishga tushsa ham tugmalar to'g'ri joyga qaytaradi", () => {
    const tree = deepShopTree();
    // Holat yo'qolgan: tarix bo'sh, lekin foydalanuvchi chatida eski xabar turadi.
    const back = backView(tree, "men", [], req);
    assert.equal(back.view.menuId, "men");
    assert.deepEqual(back.stack, ["shop", "clothing", "men"]);

    // Mahsulot kartasi ham holatga tayanmaydi — manzil callback ichida.
    const card = productView(tree, tree.find((b) => b.id === "iphone")!, req);
    assert.ok(callbacks(card.markup).includes("nav:back:electronics"));
  });
});

describe("har bir ekranda chiqish yo'li bor", () => {
  const tree = deepShopTree();
  const iphone = tree.find((button) => button.id === "iphone")!;

  const screens: [string, View][] = [
    ["mahsulot", productView(tree, iphone, req)],
    ["savatcha (bo'sh)", cartView(tree, EMPTY_CART, "shop", req)],
    ["savatcha (to'la)", cartView(tree, addToCart(EMPTY_CART, "iphone"), "shop", req)],
    ["buyurtmalar (bo'sh)", ordersView(tree, [], "shop", req)],
    ["sevimlilar (bo'sh)", favoritesView(tree, [], "shop", req)],
    ["sevimlilar (to'la)", favoritesView(tree, ["iphone"], "shop", req)],
    ["profil", profileView(null, "shop", req)],
    ["sozlamalar", settingsView(req)],
    ["yordam", helpView(null, "shop", req)],
    ["ichki menyu", menuView(tree, "clothing", { kind: "menu", menuId: "shop" }, req)],
    ["bo'sh bo'lim", menuView(tree, "women", { kind: "menu", menuId: "clothing" }, req)],
  ];

  for (const [name, view] of screens) {
    test(`${name} ekranidan chiqish mumkin`, () => {
      assert.ok(hasExit(view.markup), `${name}: «orqaga»/«bosh menyu» yo'q`);
      assert.ok(view.text.trim().length > 0, `${name}: matn bo'sh`);
      // Mobil ekran: bitta qatorda 3 tadan ortiq tugma bo'lmasin (§18).
      if (isInline(view.markup)) {
        for (const row of view.markup.inline_keyboard) {
          assert.ok(row.length <= 3, `${name}: qatorda ${row.length} tugma`);
        }
      }
    });
  }

  test("sozlanmagan bot ham nima qilish kerakligini aytadi", () => {
    const view = rootView([], req);
    assert.match(view.text, /hozircha sozlanmagan/);
  });

  test("callback'lar Telegram chegarasiga sig'adi", () => {
    for (const [name, view] of screens) {
      for (const data of callbacks(view.markup)) {
        assert.ok(
          new TextEncoder().encode(data).length <= 64,
          `${name}: «${data}» 64 baytdan uzun`,
        );
      }
    }
  });
});
