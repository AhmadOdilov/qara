/**
 * Tizim ekranlari: buyurtmalar, sevimlilar, profil, sozlamalar, yordam va
 * xato holatlari (§7, §8, §14, §15).
 *
 * Ekranlar sof funksiya bo'lgani uchun baza kerak emas — router faqat
 * ma'lumotni olib keladi, ko'rinishni esa shu funksiyalar hal qiladi.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { NAV, parseCallback } from "../../lib/bots/buttons/callback";
import { backLabel, homeLabel } from "../../lib/bots/buttons/compiler";
import {
  isFavorite,
  MAX_FAVORITES,
  readFavorites,
  resolveFavorites,
  toggleFavorite,
} from "../../lib/bots/buttons/favorites";
import {
  favoritesView,
  fallbackView,
  helpView,
  orderView,
  ordersView,
  productView,
  profileView,
  settingsView,
} from "../../lib/bots/buttons/navigation";
import {
  formatOrderDate,
  orderButtonLabel,
  orderStage,
  orderStatusLabel,
  orderText,
  readOrderItems,
  type OrderRecord,
} from "../../lib/bots/buttons/orders";
import { callbackFor, callbacks, deepShopTree, labels, viewer } from "./helpers";

const req = { viewer: viewer() };

function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    code: "A1B2C3",
    status: "pending",
    amount: 500_000,
    currency: "UZS",
    createdAt: new Date("2026-08-17T09:30:00.000Z"),
    items: [{ title: "iPhone 15 Pro", qty: 1, amount: 500_000 }],
    ...overrides,
  };
}

/* ── Buyurtmalar (§8) ────────────────────────────────────────────────────── */

describe("buyurtma holatlari", () => {
  test("bazadagi turli nomlar bitta belgiga yig'iladi", () => {
    assert.equal(orderStage("pending"), "pending");
    assert.equal(orderStage("PAID"), "processing");
    assert.equal(orderStage(" delivering "), "shipping");
    assert.equal(orderStage("delivered"), "done");
    assert.equal(orderStage("refunded"), "cancelled");
  });

  test("noma'lum holat jim yiqilmaydi — «kutilmoqda» ko'rinadi", () => {
    assert.equal(orderStage("something_new"), "pending");
    assert.equal(orderStatusLabel("something_new", "uz"), "🟡 Kutilmoqda");
  });

  test("har bir holatning rangi dizayn tizimidan", () => {
    assert.match(orderStatusLabel("pending", "uz"), /^🟡/);
    assert.match(orderStatusLabel("paid", "uz"), /^🔵/);
    assert.match(orderStatusLabel("shipped", "uz"), /^🚚/);
    assert.match(orderStatusLabel("delivered", "uz"), /^🟢/);
    assert.match(orderStatusLabel("cancelled", "uz"), /^🔴/);
  });

  test("sana barqaror formatda va mahalliy vaqt bo'yicha", () => {
    // UTC+5: 23:59Z allaqachon ertangi kun — foydalanuvchi buyurtmani
    // «kecha» deb ko'rmasligi kerak.
    assert.equal(formatOrderDate(new Date("2026-08-17T23:59:00.000Z")), "18.08.2026");
    assert.equal(formatOrderDate(new Date("2026-01-05T00:00:00.000Z")), "05.01.2026");
    // Kun boshi va oxiri chegarasi
    assert.equal(formatOrderDate(new Date("2026-08-17T19:00:00.000Z")), "18.08.2026");
    assert.equal(formatOrderDate(new Date("2026-08-17T18:59:00.000Z")), "17.08.2026");
  });

  test("tugma yorlig'i mobil ekranga sig'adi", () => {
    const label = orderButtonLabel(order(), "uz");
    assert.equal(label, "🟡 A1B2C3 · 500 000 so'm");
    assert.ok(label.length <= 64);
  });

  test("buzilgan payload buyurtmani yo'qotmaydi", () => {
    assert.deepEqual(readOrderItems(null), []);
    assert.deepEqual(readOrderItems({ items: "yo'q" }), []);
    assert.deepEqual(readOrderItems({ items: [{ qty: 2 }] }), []);
    assert.deepEqual(readOrderItems({ items: [{ title: "Non", qty: 0, amount: "x" }] }), [
      { title: "Non", qty: 1, amount: 0 },
    ]);
  });
});

describe("buyurtmalar ekrani", () => {
  test("buyurtma yo'q bo'lsa katalogga taklif qiladi", () => {
    const tree = deepShopTree();
    const view = ordersView(tree, [], "shop", req);

    assert.match(view.text, /hali buyurtma yo'q/);
    assert.deepEqual(callbacks(view.markup), ["cb_shop", "nav:back:shop", NAV.home]);
  });

  test("ro'yxatda holat, summa va sana ko'rinadi", () => {
    const tree = deepShopTree();
    const view = ordersView(
      tree,
      [order(), order({ code: "Z9Y8X7", status: "delivered", amount: 120_000 })],
      null,
      req,
    );

    assert.match(view.text, /🟡 Kutilmoqda · A1B2C3/);
    assert.match(view.text, /🟢 Yetkazildi · Z9Y8X7/);
    assert.match(view.text, /17\.08\.2026/);
    assert.deepEqual(callbacks(view.markup), [
      "ord:one:A1B2C3",
      "ord:one:Z9Y8X7",
      "nav:back:_",
    ]);
  });

  test("matnda ortiqcha bo'sh qator qolmaydi", () => {
    const view = ordersView(deepShopTree(), [order(), order({ code: "Z9Y8X7" })], null, req);

    // Sarlavha, har bir buyurtma va izoh bittadan bo'sh qator bilan
    // ajraladi — uch va undan ortiq ketma-ket qator xato belgisi.
    assert.doesNotMatch(view.text, /\n{3,}/);
    assert.match(view.text, /📦 Buyurtmalarim\n\n🟡/);
  });

  test("ro'yxat uzun bo'lsa 10 tasi ko'rsatiladi", () => {
    const many = Array.from({ length: 14 }, (_, index) =>
      order({ code: `CODE${index}` }),
    );
    const view = ordersView(deepShopTree(), many, null, req);
    const buttons = callbacks(view.markup).filter((data) => data.startsWith("ord:one:"));
    assert.equal(buttons.length, 10);
  });

  test("tafsilotdan «orqaga» ro'yxatga qaytaradi", () => {
    const view = orderView(order(), req);

    assert.match(view.text, /Buyurtma A1B2C3/);
    assert.match(view.text, /Holati: 🟡 Kutilmoqda/);
    assert.match(view.text, /1\. iPhone 15 Pro × 1/);
    assert.match(view.text, /Jami: 500 000 so'm/);
    assert.equal(callbackFor(view.markup, backLabel("uz")), NAV.orders);
    assert.equal(callbackFor(view.markup, homeLabel("uz")), NAV.home);
  });

  test("mahsulotsiz buyurtma ham summasi bilan ko'rinadi", () => {
    const text = orderText(order({ items: [] }), "uz");
    assert.ok(!text.includes("Mahsulotlar:"));
    assert.match(text, /Jami: 500 000 so'm/);
  });
});

/* ── Sevimlilar ──────────────────────────────────────────────────────────── */

describe("sevimlilar hisobi", () => {
  test("bitta tugma qo'shadi va olib tashlaydi", () => {
    const added = toggleFavorite([], "iphone");
    assert.deepEqual(added, { favorites: ["iphone"], added: true });

    const removed = toggleFavorite(added.favorites, "iphone");
    assert.deepEqual(removed, { favorites: [], added: false });
  });

  test("buzilgan ma'lumot bo'sh ro'yxatga aylanadi", () => {
    assert.deepEqual(readFavorites(null), []);
    assert.deepEqual(readFavorites({ favorites: "iphone" }), []);
    assert.deepEqual(readFavorites({ favorites: ["iphone", "iphone", 7, ""] }), ["iphone"]);
  });

  test("ro'yxat cheksiz o'smaydi", () => {
    let favorites: string[] = [];
    for (let index = 0; index < MAX_FAVORITES + 5; index += 1) {
      favorites = toggleFavorite(favorites, `p${index}`).favorites;
    }
    assert.equal(favorites.length, MAX_FAVORITES);
    assert.ok(favorites.includes(`p${MAX_FAVORITES + 4}`), "oxirgisi saqlanadi");
  });

  test("nashrdan chiqib ketgan mahsulot ro'yxatdan tushadi", () => {
    const tree = deepShopTree().filter((button) => button.id !== "iphone");
    assert.deepEqual(resolveFavorites(tree, ["iphone", "dress"]).map((i) => i.button.id), [
      "dress",
    ]);
  });

  test("mahsulot bo'lmagan tugma sevimlilarga tushmaydi", () => {
    assert.deepEqual(resolveFavorites(deepShopTree(), ["shop"]), []);
  });

  test("isFavorite ma'lumot yetmasa ham yiqilmaydi", () => {
    assert.equal(isFavorite(undefined, "iphone"), false);
    assert.equal(isFavorite(["iphone"], "iphone"), true);
  });
});

describe("sevimlilar ekrani", () => {
  test("bo'sh holatda katalog tugmasi bo'ladi", () => {
    const view = favoritesView(deepShopTree(), [], null, req);

    assert.match(view.text, /Sevimlilar ro'yxati bo'sh/);
    assert.deepEqual(callbacks(view.markup), ["cb_shop", "nav:back:_"]);
  });

  test("har bir sevimli mahsulot kartasiga olib boradi", () => {
    const view = favoritesView(deepShopTree(), ["iphone", "dress"], "shop", req);

    assert.deepEqual(callbacks(view.markup), [
      "cb_iphone",
      "cb_dress",
      NAV.favoritesClear,
      "nav:back:shop",
      NAV.home,
    ]);
    assert.ok(
      labels(view.markup).some((label) => label.includes("iPhone 15 Pro · 12 500 000 so'm")),
      "yorliqda narx ko'rinadi",
    );
  });

  test("mahsulot kartasidagi ❤️ holatga qarab o'zgaradi", () => {
    const tree = deepShopTree();
    const iphone = tree.find((button) => button.id === "iphone")!;

    const off = productView(tree, iphone, req);
    assert.ok(labels(off.markup).includes("❤️ Sevimlilarga"));

    const on = productView(tree, iphone, { ...req, favorites: ["iphone"] });
    assert.ok(labels(on.markup).includes("💔 Sevimlilardan olish"));
    assert.equal(callbackFor(on.markup, "💔 Sevimlilardan olish"), "fav:on:cb_iphone");
  });

  test("boshqa foydalanuvchiga ko'rinmaydigan mahsulot ro'yxatga chiqmaydi", () => {
    const tree = deepShopTree();
    const iphone = tree.find((button) => button.id === "iphone")!;
    iphone.adminOnly = true;

    const asUser = favoritesView(tree, ["iphone"], null, req);
    assert.match(asUser.text, /bo'sh/);

    const asAdmin = favoritesView(tree, ["iphone"], null, {
      viewer: viewer({ isAdmin: true }),
    });
    assert.ok(callbacks(asAdmin.markup).includes("cb_iphone"));
  });
});

/* ── Profil va sozlamalar (§7) ───────────────────────────────────────────── */

describe("profil ekrani", () => {
  test("ma'lumotlar tartibli, bo'shlari aniq belgilanadi", () => {
    const view = profileView(null, "shop", req);

    assert.match(view.text, /👤 Profil/);
    assert.match(view.text, /Ism: ko'rsatilmagan/);
    assert.match(view.text, /Telefon: ko'rsatilmagan/);
    assert.match(view.text, /Til: 🇺🇿 O'zbekcha/);
  });

  test("mavjud ma'lumot ko'rsatiladi", () => {
    const view = profileView("Akhmadbek", null, {
      viewer: viewer({ phone: "+998900000000", email: "a@b.uz" }),
    });
    assert.match(view.text, /Ism: Akhmadbek/);
    assert.match(view.text, /Telefon: \+998900000000/);
    assert.match(view.text, /Email: a@b\.uz/);
  });

  test("profildan buyurtma, sevimlilar va sozlamalarga o'tiladi", () => {
    const view = profileView(null, "shop", req);
    assert.deepEqual(callbacks(view.markup), [
      NAV.orders,
      NAV.favorites,
      NAV.settings,
      "nav:back:shop",
      NAV.home,
    ]);
  });

  test("sozlamalardan «orqaga» profilga qaytaradi", () => {
    const view = settingsView(req);
    assert.deepEqual(callbacks(view.markup), [
      "btn_lang_uz",
      "btn_lang_ru",
      "btn_lang_en",
      NAV.setName,
      NAV.sharePhone,
      NAV.profile,
      NAV.home,
    ]);
  });

  test("profil tili foydalanuvchi tiliga qarab yoziladi", () => {
    const ru = profileView(null, null, { viewer: viewer({ languageCode: "ru" }) });
    assert.match(ru.text, /👤 Профиль/);
    assert.match(ru.text, /Язык: 🇷🇺 Русский/);
  });
});

/* ── Yordam va xatolar (§13, §15) ────────────────────────────────────────── */

describe("yordam ekrani", () => {
  test("egasi matn yozmasa ham tushunarli matn chiqadi", () => {
    const view = helpView(null, "shop", req);
    assert.match(view.text, /ℹ️ Yordam/);
    assert.ok(view.text.length > 20, "bo'sh ekran qolmaydi");
    assert.deepEqual(callbacks(view.markup), ["nav:back:shop", NAV.home]);
  });

  test("egasi yozgan matn ustun turadi", () => {
    const view = helpView("Ish vaqti: 09:00–18:00", null, req);
    assert.match(view.text, /Ish vaqti: 09:00–18:00/);
    assert.deepEqual(callbacks(view.markup), ["nav:back:_"]);
  });
});

describe("xato ekranlari", () => {
  test("texnik matn emas, chiqish yo'li ko'rsatiladi", () => {
    const view = fallbackView("somethingWrong", req);
    assert.match(view.text, /Nimadir xato ketdi/);
    assert.ok(!/callback|error|undefined/i.test(view.text), "texnik atama yo'q");
    assert.deepEqual(callbacks(view.markup), [NAV.home]);
  });

  test("kelgan joy ma'lum bo'lsa «orqaga» ham beriladi", () => {
    const view = fallbackView("staleButton", req, "shop");
    assert.deepEqual(callbacks(view.markup), ["nav:back:shop", NAV.home]);
  });

  test("o'chirilgan buyurtma alohida tushuntiriladi", () => {
    assert.match(fallbackView("orderGone", req).text, /buyurtma topilmadi/);
    assert.match(fallbackView("menuGone", req).text, /bo'lim endi mavjud emas/);
  });
});

/* ── Callback fazolari (§11) ──────────────────────────────────────────────── */

describe("callback to'qnashuvi", () => {
  test("har bir tizim callback'i o'z turiga tushadi", () => {
    const cases: [string, string][] = [
      [NAV.home, "home"],
      [NAV.cartOpen, "cart_open"],
      [NAV.cartClear, "cart_clear"],
      [NAV.cartCheckout, "cart_checkout"],
      [NAV.favorites, "favorites"],
      [NAV.favoritesClear, "favorites_clear"],
      [NAV.orders, "orders"],
      [NAV.profile, "profile"],
      [NAV.settings, "settings"],
      [NAV.setName, "set_name"],
      [NAV.sharePhone, "share_phone"],
      [NAV.help, "help"],
    ];
    for (const [data, kind] of cases) {
      assert.equal(parseCallback(data).kind, kind, data);
    }
  });

  test("miqdor callback'i qaytish joyini ham tashiydi", () => {
    assert.deepEqual(parseCallback("cart:inc:btn_1"), {
      kind: "cart_qty",
      product: "btn_1",
      op: "inc",
      then: "cart",
    });
    assert.deepEqual(parseCallback("cart:dec:btn_1:p"), {
      kind: "cart_qty",
      product: "btn_1",
      op: "dec",
      then: "product",
    });
    assert.deepEqual(parseCallback("cart:del:btn_1"), {
      kind: "cart_qty",
      product: "btn_1",
      op: "del",
      then: "cart",
    });
  });

  test("tugma ko'rsatgichi tizim nomlari bilan aralashmaydi", () => {
    assert.deepEqual(parseCallback("btn_cart"), { kind: "button", id: "btn_cart" });
    assert.deepEqual(parseCallback("btn_help"), { kind: "button", id: "btn_help" });
    assert.deepEqual(parseCallback("btn_profile"), { kind: "button", id: "btn_profile" });
  });

  test("sevimlilar va buyurtma callback'lari ko'rsatgichni ajratadi", () => {
    assert.deepEqual(parseCallback("fav:on:btn_9"), {
      kind: "favorite_toggle",
      product: "btn_9",
    });
    assert.deepEqual(parseCallback("ord:one:A1B2C3"), { kind: "order", code: "A1B2C3" });
  });

  test("eski «orqaga» tugmasi hamon ishlaydi", () => {
    assert.deepEqual(parseCallback("btn_back"), { kind: "back", menu: undefined });
    assert.deepEqual(parseCallback("nav:back"), { kind: "back", menu: undefined });
    assert.deepEqual(parseCallback("nav:back:_"), { kind: "back", menu: null });
    assert.deepEqual(parseCallback("nav:back:shop"), { kind: "back", menu: "shop" });
  });
});
