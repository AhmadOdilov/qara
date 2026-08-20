import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { executeAction, type ActionContext } from "../../lib/bots/buttons/actions";
import { addToCart, EMPTY_CART } from "../../lib/bots/buttons/cart";
import { backLabel, homeLabel } from "../../lib/bots/buttons/compiler";
import {
  ACTION_TYPES,
  isPendingAction,
  type ButtonRecord,
} from "../../lib/bots/buttons/types";
import { btn, callbacks, deepShopTree, labels, node, viewer } from "./helpers";

/** Bitta tugma bosilishini bajaradi. */
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

describe("menyu amallari", () => {
  test("ichki menyuni ochadi va tarixga qo'shadi", async () => {
    const tree = deepShopTree();
    const result = await press(tree, "clothing", { menuStack: ["shop"] });

    assert.equal(result.ok, true);
    assert.equal(result.menuId, "clothing");
    assert.deepEqual(result.menuStack, ["shop", "clothing"]);
    assert.equal(result.editable, true);
    assert.deepEqual(labels(result.markup!), [
      "men",
      "women",
      backLabel("uz"),
      homeLabel("uz"),
    ]);
  });

  test("bo'sh menyuga kirmaydi, joyida qoladi", async () => {
    const tree = [
      node("m", null, { layout: 1 }),
      node("empty", "m", { emptyText: "Hozircha yo'q" }),
    ];
    const result = await press(tree, "empty", { menuStack: ["m"] });

    assert.equal(result.text, "Hozircha yo'q");
    assert.equal(result.menuId, "m");
    assert.equal(result.menuStack, undefined, "tarix o'zgarmaydi");
  });

  test("kategoriya submenu bilan bir xil ishlaydi", async () => {
    const tree = [
      node("root", null),
      node("cat", "root", { title: "Kategoriya" }, { actionType: "category" }),
      btn({ id: "leaf", parentId: "cat" }),
    ];
    const result = await press(tree, "cat", { menuStack: ["root"] });
    assert.equal(result.menuId, "cat");
    assert.deepEqual(labels(result.markup!), ["leaf", backLabel("uz"), homeLabel("uz")]);
  });

  test("«orqaga» tugmasi bir pog'ona yuqoriga chiqaradi", async () => {
    const tree = deepShopTree();
    tree.push(btn({ id: "back-btn", parentId: "men", actionType: "back" }));

    const result = await press(tree, "back-btn", {
      menuStack: ["shop", "clothing", "men"],
    });
    assert.equal(result.menuId, "clothing");
    assert.deepEqual(result.menuStack, ["shop", "clothing"]);
  });

  test("«bosh menyu» ildizga qaytaradi va tarixni tozalaydi", async () => {
    const tree = deepShopTree();
    tree.push(btn({ id: "home-btn", parentId: "shirts", actionType: "home" }));

    const result = await press(tree, "home-btn", {
      menuStack: ["shop", "clothing", "men", "shirts"],
    });
    assert.equal(result.menuId, null);
    assert.deepEqual(result.menuStack, []);
    assert.deepEqual(labels(result.markup!), ["shop", "Savat"]);
  });

  test("xabar yuborilganda foydalanuvchi turgan menyuda qoladi", async () => {
    const tree = [
      node("m", null, { layout: 1 }),
      btn({ id: "info", parentId: "m", actionConfig: { text: "Salom" } }),
    ];
    const result = await press(tree, "info", { menuStack: ["m"] });

    assert.equal(result.text, "Salom");
    assert.equal(result.menuId, "m", "ildizga otib tashlamaydi");
    assert.deepEqual(labels(result.markup!), ["info", backLabel("uz")]);
  });

  test("menyuni yopish klaviaturani olib tashlaydi", async () => {
    const tree = [btn({ id: "close", actionType: "close_menu" })];
    const result = await press(tree, "close");

    assert.deepEqual(result.markup, { remove_keyboard: true });
    assert.equal(result.editable, false, "yangi xabar bo'lishi kerak");
    assert.deepEqual(result.menuStack, []);
  });
});

describe("do'kon amallari", () => {
  test("mahsulot kartasi ko'rsatiladi", async () => {
    const tree = deepShopTree();
    const result = await press(tree, "iphone");

    assert.match(result.text, /iPhone 15 Pro/);
    assert.match(result.text, /12 500 000 so'm/);
    assert.equal(result.editable, true);
  });

  test("savatga qo'shish direktiva qaytaradi", async () => {
    const tree = deepShopTree();
    tree.push(
      btn({
        id: "add",
        parentId: "electronics",
        actionType: "add_to_cart",
        actionConfig: { productId: "iphone" },
      }),
    );

    const result = await press(tree, "add");
    assert.deepEqual(result.cart, { op: "add", productId: "iphone", then: "stay" });
    assert.equal(result.toast, "✅ Savatchaga qo'shildi");
  });

  test("mavjud bo'lmagan mahsulotga ulangan tugma ogohlantiradi", async () => {
    const tree = deepShopTree();
    tree.push(
      btn({
        id: "add",
        parentId: "electronics",
        actionType: "add_to_cart",
        actionConfig: { productId: "yo'q" },
      }),
    );

    const result = await press(tree, "add");
    assert.equal(result.ok, false);
    assert.match(result.text, /eskirgan/);
    assert.equal(result.cart, undefined, "savat o'zgarmaydi");
  });

  test("savat ekrani jami summani ko'rsatadi", async () => {
    const tree = deepShopTree();
    const result = await press(tree, "cart", {
      cart: addToCart(EMPTY_CART, "iphone"),
    });

    assert.match(result.text, /Jami: 12 500 000 so'm/);
  });

  test("bo'sh savatda buyurtma qabul qilinmaydi", async () => {
    const tree = deepShopTree();
    tree.push(btn({ id: "pay", parentId: "shop", actionType: "checkout" }));

    const result = await press(tree, "pay");
    assert.equal(result.ok, false);
    assert.equal(result.cart, undefined);
  });

  test("buyurtma summasi savatdan hisoblanadi", async () => {
    const tree = deepShopTree();
    tree.push(btn({ id: "pay", parentId: "shop", actionType: "checkout" }));

    let cart = addToCart(EMPTY_CART, "iphone");
    cart = addToCart(cart, "iphone");
    cart = addToCart(cart, "dress");

    const result = await press(tree, "pay", { cart });
    assert.ok(result.cart && result.cart.op === "checkout");
    if (result.cart?.op === "checkout") {
      assert.equal(result.cart.total, 12_500_000 * 2 + 420_000);
      assert.equal(result.cart.currency, "UZS");
      assert.deepEqual(
        result.cart.items.map((line) => [line.productId, line.qty]),
        [
          ["iphone", 2],
          ["dress", 1],
        ],
      );
    }
    assert.deepEqual(result.menuStack, [], "buyurtmadan keyin ildizga qaytadi");
  });
});

describe("sozlanmagan va ixtiyoriy amallar", () => {
  test("AI amali ochiq javob qaytaradi", async () => {
    const tree = [node("m", null), btn({ id: "ai", parentId: "m", actionType: "ai_chat" })];
    const result = await press(tree, "ai");

    assert.equal(result.ok, false);
    assert.match(result.text, /sozlanmagan/);
    assert.equal(result.toast, "Hali sozlanmagan");
  });

  test("ixtiyoriy amal egasi yozgan matnni qaytaradi", async () => {
    const tree = [
      node("m", null),
      btn({
        id: "custom",
        parentId: "m",
        actionType: "custom",
        actionConfig: { text: "Ariza qabul qilindi" },
      }),
    ];
    const result = await press(tree, "custom");

    assert.equal(result.ok, true);
    assert.equal(result.text, "Ariza qabul qilindi");
    assert.equal(result.menuId, "m");
  });

  test("mini app manzilsiz bo'lsa jim yiqilmaydi", async () => {
    const tree = [node("m", null), btn({ id: "app", parentId: "m", actionType: "open_mini_app" })];
    const result = await press(tree, "app");

    assert.equal(result.ok, false);
    assert.match(result.text, /ko'rsatilmagan/);
  });
});

describe("til va sozlamalar", () => {
  test("til tanlash ekrani boshi berk ko'cha emas", async () => {
    const tree = deepShopTree();
    tree.push(btn({ id: "lang", parentId: "shop", actionType: "change_language" }));

    const result = await press(tree, "lang", { menuStack: ["shop"] });
    assert.deepEqual(callbacks(result.markup!), [
      "btn_lang_uz",
      "btn_lang_ru",
      "btn_lang_en",
      "nav:back:shop",
    ]);
    assert.equal(result.menuId, "shop", "til tanlangach ham o'z bo'limida qoladi");
  });

  test("yorliq foydalanuvchi tiliga moslashadi", async () => {
    const tree = deepShopTree();
    tree.push(btn({ id: "lang", parentId: "shop", actionType: "change_language" }));

    const result = await press(tree, "lang", {
      menuStack: ["shop"],
      viewer: viewer({ languageCode: "ru" }),
      lang: "ru",
    });
    assert.ok(labels(result.markup!).includes("⬅️ Назад"));
  });
});

describe("har bir amal javob beradi", () => {
  // §21: «Har bir asosiy knopka ishlaydi». Sozlanmagan amal ham javob
  // qaytaradi — jim yiqilish yo'q, foydalanuvchi doim natija ko'radi.
  for (const action of ACTION_TYPES) {
    test(`«${action}» amali bo'sh javob qoldirmaydi`, async () => {
      const tree = [
        ...deepShopTree(),
        btn({ id: "target", parentId: "shop", actionType: action }),
      ];
      const result = await press(tree, "target", { menuStack: ["shop"] });

      assert.equal(typeof result.text, "string");
      assert.ok(result.text.trim().length > 0, "matn bo'sh");
      assert.ok(result.markup, "klaviatura yo'q");
      if (isPendingAction(action)) {
        assert.equal(result.ok, false, "sozlanmagan amal ochiq aytiladi");
      }
    });
  }
});

describe("ruxsat", () => {
  test("admin tugmasi oddiy foydalanuvchi menyusida ko'rinmaydi", async () => {
    const tree = [
      node("m", null, { layout: 1 }),
      btn({ id: "open", parentId: null, actionType: "submenu", actionConfig: { targetId: "m" } }),
      btn({ id: "public", parentId: "m", actionConfig: { text: "ok" } }),
      btn({ id: "secret", parentId: "m", adminOnly: true }),
    ];

    const asUser = await press(tree, "open");
    assert.ok(!labels(asUser.markup!).includes("secret"));

    const asAdmin = await press(tree, "open", { viewer: viewer({ isAdmin: true }) });
    assert.ok(labels(asAdmin.markup!).includes("secret"));
  });
});
