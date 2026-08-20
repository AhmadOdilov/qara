import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { backTo, NAV, parseCallback } from "../../lib/bots/buttons/callback";
import { backLabel, compileMenu, homeLabel } from "../../lib/bots/buttons/compiler";
import { menuDepth, menuPath, resolveMenuTarget } from "../../lib/bots/buttons/menu";
import {
  backView,
  menuView,
  openMenuView,
  productView,
  rootView,
  sanitizeStack,
  stackFor,
} from "../../lib/bots/buttons/navigation";
import type { ButtonRecord } from "../../lib/bots/buttons/types";
import {
  btn,
  callbackFor,
  callbacks,
  deepShopTree,
  labels,
  node,
  product,
  rows,
  viewer,
} from "./helpers";

const req = { viewer: viewer() };

/** Menyuni ochib, keyingi ekranni qaytaradi. */
function open(tree: ButtonRecord[], id: string, from: string | null) {
  const button = tree.find((b) => b.id === id);
  assert.ok(button, `${id} topilmadi`);
  return openMenuView(tree, button, from, req);
}

describe("menyu daraxti", () => {
  test("ildiz menyusi faqat ildiz tugmalarini ko'rsatadi", () => {
    const tree = deepShopTree();
    const view = rootView(tree, req);

    assert.deepEqual(labels(view.markup), ["shop", "Savat"]);
    // Ildizda «orqaga» bo'lmaydi — qaytadigan joy yo'q.
    assert.ok(!labels(view.markup).includes(backLabel("uz")));
    assert.equal(view.menuId, null);
  });

  test("5 qatlam ichkariga kirib boradi", () => {
    const tree = deepShopTree();

    const shop = open(tree, "shop", null);
    assert.deepEqual(labels(shop.markup), [
      "clothing",
      "electronics",
      backLabel("uz"),
    ]);

    const clothing = open(tree, "clothing", "shop");
    assert.equal(clothing.menuId, "clothing");
    // 2-qatlamdan boshlab «bosh menyu» ham chiqadi.
    assert.ok(labels(clothing.markup).includes(homeLabel("uz")));

    const men = open(tree, "men", "clothing");
    const shirts = open(tree, "shirts", "men");
    assert.deepEqual(labels(shirts.markup).slice(0, 2), ["shirt-classic", "shirt-slim"]);
    assert.equal(menuDepth(tree, "shirts"), 4);
    assert.equal(men.menuId, "men");
  });

  test("chuqurlik va yo'l to'g'ri hisoblanadi", () => {
    const tree = deepShopTree();
    assert.equal(menuDepth(tree, null), 0);
    assert.equal(menuDepth(tree, "shop"), 1);
    assert.deepEqual(
      menuPath(tree, "shirts").map((b) => b.id),
      ["shop", "clothing", "men", "shirts"],
    );
  });
});

describe("orqaga navigatsiya", () => {
  test("har bir menyu «orqaga» manzilini o'zi bilan tashiydi", () => {
    const tree = deepShopTree();
    const shirts = open(tree, "shirts", "men");

    // Manzil callback ichida: server holati kerak emas.
    assert.equal(callbackFor(shirts.markup, backLabel("uz")), backTo("men"));
  });

  test("5-qatlamdan ildizga qadam-baqadam qaytadi", () => {
    const tree = deepShopTree();
    let stack = stackFor(tree, "shirts");
    assert.deepEqual(stack, ["shop", "clothing", "men", "shirts"]);

    const steps: (string | null)[] = [];
    for (let i = 0; i < 5; i++) {
      const result = backView(tree, undefined, stack, req);
      stack = result.stack;
      steps.push(result.view.menuId);
    }

    assert.deepEqual(steps, ["men", "clothing", "shop", null, null]);
  });

  test("manzilli «orqaga» tarixdan mustaqil ishlaydi", () => {
    const tree = deepShopTree();
    // Tarix bo'sh (bot qayta ishga tushgan, holat yo'qolgan) — tugma hamon
    // to'g'ri joyga qaytaradi.
    const result = backView(tree, "clothing", [], req);
    assert.equal(result.view.menuId, "clothing");
    assert.deepEqual(result.stack, ["shop", "clothing"]);
  });

  test("o'chirilgan menyuga qaytish ildizga tushiradi", () => {
    const tree = deepShopTree().filter((b) => b.id !== "clothing");
    const result = backView(tree, "clothing", [], req);
    assert.equal(result.view.menuId, null);
  });

  test("tarixdagi o'chirilgan menyular tashlab yuboriladi", () => {
    const tree = deepShopTree().filter((b) => b.id !== "men");
    assert.deepEqual(sanitizeStack(tree, ["shop", "clothing", "men", "shirts"]), [
      "shop",
      "clothing",
    ]);
  });
});

describe("bosh menyu tugmasi", () => {
  test("chuqur menyuda ko'rinadi, birinchi qatlamda yo'q", () => {
    const tree = deepShopTree();
    const shop = open(tree, "shop", null);
    const clothing = open(tree, "clothing", "shop");

    assert.ok(!labels(shop.markup).includes(homeLabel("uz")));
    assert.ok(labels(clothing.markup).includes(homeLabel("uz")));
  });

  test("showHome sozlamasi birinchi qatlamda ham majburlaydi", () => {
    const tree = deepShopTree();
    const electronics = open(tree, "electronics", "shop");
    assert.ok(labels(electronics.markup).includes(homeLabel("uz")));
    assert.equal(callbackFor(electronics.markup, homeLabel("uz")), NAV.home);
  });
});

describe("ulangan menyu (target)", () => {
  test("boshqa tugunni ochadi va o'z joyiga qaytaradi", () => {
    const tree = deepShopTree();
    tree.push(node("promo", null, { targetId: "electronics" }));

    const promo = tree.find((b) => b.id === "promo")!;
    assert.equal(resolveMenuTarget(tree, promo), "electronics");

    const view = openMenuView(tree, promo, null, req);
    assert.equal(view.menuId, "electronics");
    // «Orqaga» daraxtdagi otasiga emas, kelgan joyga qaytaradi.
    assert.equal(callbackFor(view.markup, backLabel("uz")), backTo(null));
  });

  test("o'ziga yoki avlodiga ulangan target e'tiborsiz qoldiriladi", () => {
    const tree = deepShopTree();
    const shop = tree.find((b) => b.id === "shop")!;

    shop.actionConfig = { targetId: "shop" };
    assert.equal(resolveMenuTarget(tree, shop), "shop");

    shop.actionConfig = { targetId: "men" };
    assert.equal(resolveMenuTarget(tree, shop), "shop");
  });

  test("mavjud bo'lmagan target o'z bolalariga qaytadi", () => {
    const tree = deepShopTree();
    const shop = tree.find((b) => b.id === "shop")!;
    shop.actionConfig = { targetId: "yo'q" };
    assert.equal(resolveMenuTarget(tree, shop), "shop");
  });
});

describe("klaviatura tuzilishi", () => {
  test("layout tugmalarni qatorlarga bo'ladi", () => {
    const tree = [
      node("m", null, { layout: 2 }),
      btn({ id: "a", parentId: "m", sortOrder: 0 }),
      btn({ id: "b", parentId: "m", sortOrder: 1 }),
      btn({ id: "c", parentId: "m", sortOrder: 2 }),
    ];
    const view = menuView(tree, "m", { kind: "menu", menuId: null }, req);
    assert.deepEqual(rows(view.markup), [["a", "b"], ["c"], [backLabel("uz")]]);
  });

  test("layout berilmasa rowIndex bo'yicha guruhlanadi", () => {
    const tree = [
      node("m", null),
      btn({ id: "a", parentId: "m", rowIndex: 0, sortOrder: 0 }),
      btn({ id: "b", parentId: "m", rowIndex: 0, sortOrder: 1 }),
      btn({ id: "c", parentId: "m", rowIndex: 1 }),
    ];
    const view = menuView(tree, "m", { kind: "menu", menuId: null }, req);
    assert.deepEqual(rows(view.markup), [["a", "b"], ["c"], [backLabel("uz")]]);
  });

  test("tartib rowIndex, keyin sortOrder bo'yicha", () => {
    const tree = [
      node("m", null, { layout: 1 }),
      btn({ id: "second", parentId: "m", rowIndex: 1, sortOrder: 0 }),
      btn({ id: "third", parentId: "m", rowIndex: 1, sortOrder: 5 }),
      btn({ id: "first", parentId: "m", rowIndex: 0, sortOrder: 9 }),
    ];
    const view = menuView(tree, "m", { kind: "none" }, req);
    assert.deepEqual(labels(view.markup), ["first", "second", "third"]);
  });

  test("sudrab ko'chirish tartibini o'zgartiradi", () => {
    const tree = [
      node("m", null, { layout: 1 }),
      btn({ id: "a", parentId: "m", rowIndex: 0 }),
      btn({ id: "b", parentId: "m", rowIndex: 1 }),
    ];
    // Konstruktordagi drag&drop aynan shu maydonlarni yozadi.
    tree[1].rowIndex = 1;
    tree[2].rowIndex = 0;
    const view = menuView(tree, "m", { kind: "none" }, req);
    assert.deepEqual(labels(view.markup), ["b", "a"]);
  });

  test("bir qatorda 8 tadan ortiq tugma bo'lmaydi", () => {
    const tree: ButtonRecord[] = [node("m", null)];
    for (let i = 0; i < 12; i++) {
      tree.push(btn({ id: `b${i}`, parentId: "m", rowIndex: 0, sortOrder: i }));
    }
    const view = menuView(tree, "m", { kind: "none" }, req);
    assert.equal(rows(view.markup)[0].length, 8);
  });

  test("reply klaviaturada navigatsiya matn tugmasi bo'ladi", () => {
    const tree = [
      node("m", null, {}, { keyboardKind: "reply", buttonType: "text" }),
      btn({ id: "a", parentId: "m", keyboardKind: "reply", buttonType: "text" }),
    ];
    const view = menuView(tree, "m", { kind: "stack" }, req);
    assert.ok(!view.editable, "reply klaviatura tahrirlanmaydi");
    assert.deepEqual(labels(view.markup), ["a", backLabel("uz")]);
  });

  test("inline menyu tahrirlanadigan deb belgilanadi", () => {
    const tree = deepShopTree();
    assert.ok(open(tree, "shop", null).editable);
  });

  test("bo'sh menyu ham chiqish yo'lini qoldiradi", () => {
    const tree = [node("m", null, { emptyText: "Bo'sh" })];
    const view = menuView(tree, "m", { kind: "menu", menuId: null }, req);
    assert.equal(view.text, "Bo'sh");
    assert.deepEqual(labels(view.markup), [backLabel("uz")]);
  });
});

describe("sarlavha va tavsif", () => {
  test("tugun sarlavhasi va tavsifi xabar matniga tushadi", () => {
    const tree = [
      node("m", null, { title: "🛍 Do'kon", description: "Kategoriyani tanlang." }),
      btn({ id: "a", parentId: "m" }),
    ];
    const view = menuView(tree, "m", { kind: "none" }, req);
    assert.equal(view.text, "🛍 Do'kon\n\nKategoriyani tanlang.");
  });

  test("sarlavha yozilmasa tugma yorlig'i ishlatiladi", () => {
    const tree = [node("m", null, {}, { text: "Menyu", emoji: "📋" }), btn({ id: "a", parentId: "m" })];
    const view = menuView(tree, "m", { kind: "none" }, req);
    assert.equal(view.text, "📋 Menyu");
  });

  test("ildiz matni /start javobidan keladi", () => {
    const tree = deepShopTree();
    const view = rootView(tree, { viewer: viewer(), rootText: "Salom!" });
    assert.equal(view.text, "Salom!");
  });
});

describe("ko'rinish va ruxsat", () => {
  test("adminOnly tugma oddiy foydalanuvchiga ko'rinmaydi", () => {
    const tree = [
      node("m", null),
      btn({ id: "public", parentId: "m" }),
      btn({ id: "secret", parentId: "m", adminOnly: true }),
    ];

    const asUser = menuView(tree, "m", { kind: "none" }, { viewer: viewer() });
    const asAdmin = menuView(tree, "m", { kind: "none" }, { viewer: viewer({ isAdmin: true }) });

    assert.deepEqual(labels(asUser.markup), ["public"]);
    assert.deepEqual(labels(asAdmin.markup), ["public", "secret"]);
  });

  test("o'chirilgan tugma klaviaturaga tushmaydi", () => {
    const tree = [node("m", null), btn({ id: "off", parentId: "m", enabled: false })];
    const view = menuView(tree, "m", { kind: "none" }, req);
    assert.deepEqual(labels(view.markup), []);
  });
});

describe("mahsulot kartasi", () => {
  test("narx, ombor va savat tugmalari ko'rsatiladi", () => {
    const tree = deepShopTree();
    const iphone = tree.find((b) => b.id === "iphone")!;
    const view = productView(tree, iphone, req);

    assert.match(view.text, /iPhone 15 Pro/);
    assert.match(view.text, /12 500 000 so'm/);
    assert.match(view.text, /🟢 Mavjud/);
    assert.deepEqual(callbacks(view.markup), [
      "cart:add:cb_iphone",
      "cart:buy:cb_iphone",
      "fav:on:cb_iphone",
      backTo("electronics"),
      NAV.home,
    ]);
  });

  test("omborda yo'q mahsulotda savat tugmasi bo'lmaydi", () => {
    const tree = deepShopTree();
    const iphone = tree.find((b) => b.id === "iphone")!;
    iphone.actionConfig = { ...iphone.actionConfig, stock: 0 };

    const view = productView(tree, iphone, req);
    assert.match(view.text, /Omborda yo'q/);
    assert.deepEqual(callbacks(view.markup), [
      "fav:on:cb_iphone",
      backTo("electronics"),
      NAV.home,
    ]);
  });
});

describe("callback formati", () => {
  test("tizim buyruqlari o'qiladi", () => {
    assert.deepEqual(parseCallback(NAV.home), { kind: "home" });
    assert.deepEqual(parseCallback(NAV.back), { kind: "back", menu: undefined });
    assert.deepEqual(parseCallback(backTo(null)), { kind: "back", menu: null });
    assert.deepEqual(parseCallback(backTo("cb_x")), { kind: "back", menu: "cb_x" });
    assert.deepEqual(parseCallback("cart:add:cb_x"), {
      kind: "cart_add",
      product: "cb_x",
      then: "stay",
    });
    assert.deepEqual(parseCallback("btn_lang_ru"), { kind: "language", lang: "ru" });
  });

  test("eski «orqaga» callback'i hamon tushuniladi", () => {
    assert.deepEqual(parseCallback("btn_back"), { kind: "back", menu: undefined });
  });

  test("noma'lum qiymat tugma ko'rsatgichi deb qabul qilinadi", () => {
    assert.deepEqual(parseCallback("btn_1a2b3c4d"), {
      kind: "button",
      id: "btn_1a2b3c4d",
    });
  });

  test("callback ichida maxfiy ma'lumot bo'lmaydi", () => {
    const tree = deepShopTree();
    const view = open(tree, "electronics", "shop");
    for (const data of callbacks(view.markup)) {
      assert.ok(new TextEncoder().encode(data).length <= 64, `${data} juda uzun`);
      assert.ok(!/1001|token|secret|password/i.test(data), `${data} ichida ortiqcha ma'lumot`);
    }
  });
});

describe("kompilyator to'g'ridan-to'g'ri", () => {
  test("URL tugmasi https bo'lmasa tashlab yuboriladi", () => {
    const tree = [
      btn({ id: "bad", buttonType: "url", actionConfig: { url: "http://a.uz" } }),
      btn({ id: "good", buttonType: "url", actionConfig: { url: "https://a.uz" } }),
    ];
    const compiled = compileMenu(tree, { parentId: null, viewer: viewer(), withBack: false });
    assert.deepEqual(labels(compiled.markup), ["good"]);
  });

  test("kontakt va joylashuv so'rovi reply klaviaturada bo'ladi", () => {
    const tree = [
      btn({ id: "phone", keyboardKind: "reply", buttonType: "contact", rowIndex: 0 }),
      btn({ id: "place", keyboardKind: "reply", buttonType: "location", rowIndex: 1 }),
    ];
    const compiled = compileMenu(tree, { parentId: null, viewer: viewer(), withBack: false });
    assert.ok("keyboard" in compiled.markup);
    if ("keyboard" in compiled.markup) {
      assert.equal(compiled.markup.keyboard[0][0].request_contact, true);
      assert.equal(compiled.markup.keyboard[1][0].request_location, true);
    }
  });

  test("tugmasiz va navigatsiyasiz menyu klaviaturani olib tashlaydi", () => {
    const compiled = compileMenu([], { parentId: null, viewer: viewer(), withBack: false });
    assert.deepEqual(compiled.markup, { remove_keyboard: true });
    assert.equal(compiled.kind, "empty");
  });
});

describe("ko'p tilli navigatsiya", () => {
  test("yorliqlar foydalanuvchi tiliga moslashadi", () => {
    const tree = deepShopTree();
    const ru = openMenuView(tree, tree.find((b) => b.id === "clothing")!, "shop", {
      viewer: viewer({ languageCode: "ru" }),
    });
    assert.ok(labels(ru.markup).includes("⬅️ Назад"));
    assert.ok(labels(ru.markup).includes("🏠 Главное меню"));
  });
});

describe("mahsulotlar ro'yxati tartibi", () => {
  test("bir menyuda mahsulot va ichki menyu birga ishlaydi", () => {
    const tree = [
      node("m", null, { layout: 1 }),
      product("p1", "m", 1000),
      node("sub", "m", { title: "Ichki" }, { rowIndex: 1 }),
    ];
    const view = menuView(tree, "m", { kind: "none" }, req);
    assert.deepEqual(labels(view.markup), ["p1", "sub"]);
  });
});
