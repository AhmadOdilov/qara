import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { NAV } from "../../lib/bots/buttons/callback";
import {
  addToCart,
  cartCount,
  cartQtyOf,
  cartTotal,
  decFromCart,
  formatMoney,
  MAX_CART_LINES,
  readCart,
  removeFromCart,
  resolveCart,
  EMPTY_CART,
} from "../../lib/bots/buttons/cart";
import { cartView } from "../../lib/bots/buttons/navigation";
import { btn, callbacks, deepShopTree, viewer } from "./helpers";

const req = { viewer: viewer() };

describe("savat hisobi", () => {
  test("bir mahsulotni ikki marta qo'shsa soni oshadi", () => {
    let cart = addToCart(EMPTY_CART, "iphone");
    cart = addToCart(cart, "iphone");
    assert.deepEqual(cart.lines, [{ productId: "iphone", qty: 2 }]);
    assert.equal(cartCount(cart), 2);
  });

  test("har xil mahsulot alohida qator bo'ladi", () => {
    let cart = addToCart(EMPTY_CART, "iphone");
    cart = addToCart(cart, "dress");
    assert.equal(cart.lines.length, 2);
  });

  test("jami summa nashr etilgan narxdan hisoblanadi", () => {
    const tree = deepShopTree();
    let cart = addToCart(EMPTY_CART, "iphone");
    cart = addToCart(cart, "dress");

    const lines = resolveCart(tree, cart);
    assert.equal(cartTotal(lines), 12_500_000 + 420_000);
  });

  test("narx o'zgarsa savat ham yangi narxni ko'rsatadi", () => {
    const tree = deepShopTree();
    const cart = addToCart(EMPTY_CART, "iphone");
    assert.equal(cartTotal(resolveCart(tree, cart)), 12_500_000);

    const iphone = tree.find((b) => b.id === "iphone")!;
    iphone.actionConfig = { ...iphone.actionConfig, price: 11_000_000 };
    assert.equal(cartTotal(resolveCart(tree, cart)), 11_000_000);
  });

  test("o'chirilgan mahsulot savatdan tushib qoladi", () => {
    const tree = deepShopTree().filter((b) => b.id !== "iphone");
    const cart = addToCart(EMPTY_CART, "iphone");
    assert.deepEqual(resolveCart(tree, cart), []);
  });

  test("mahsulot bo'lmagan tugma savatga tushmaydi", () => {
    const tree = deepShopTree();
    const cart = addToCart(EMPTY_CART, "shop");
    assert.deepEqual(resolveCart(tree, cart), []);
  });
});

describe("savatni o'qish", () => {
  test("buzilgan ma'lumot bo'sh savatga aylanadi", () => {
    assert.deepEqual(readCart(null), EMPTY_CART);
    assert.deepEqual(readCart({ cart: "nimadir" }), EMPTY_CART);
    assert.deepEqual(readCart({ cart: { lines: [{ qty: 2 }] } }), EMPTY_CART);
    assert.deepEqual(readCart({ cart: { lines: [{ productId: "x", qty: -3 }] } }), EMPTY_CART);
  });

  test("saqlangan savat o'qiladi", () => {
    const stored = { cart: { lines: [{ productId: "iphone", qty: 3 }] }, other: 1 };
    assert.deepEqual(readCart(stored).lines, [{ productId: "iphone", qty: 3 }]);
  });
});

describe("narx ko'rinishi", () => {
  test("mingliklar ajratiladi va valyuta qo'shiladi", () => {
    assert.equal(formatMoney(12_500_000), "12 500 000 so'm");
    assert.equal(formatMoney(65_000), "65 000 so'm");
    assert.equal(formatMoney(999), "999 so'm");
    assert.equal(formatMoney(1_200, "USD"), "1 200 USD");
    assert.equal(formatMoney(0), "0 so'm");
  });
});

describe("miqdorni o'zgartirish", () => {
  test("kamaytirish soni bittaga tushiradi", () => {
    let cart = addToCart(EMPTY_CART, "iphone");
    cart = addToCart(cart, "iphone");
    cart = addToCart(cart, "iphone");

    cart = decFromCart(cart, "iphone");
    assert.deepEqual(cart.lines, [{ productId: "iphone", qty: 2 }]);
    assert.equal(cartQtyOf(cart, "iphone"), 2);
  });

  test("oxirgi donani kamaytirish qatorni butunlay olib tashlaydi", () => {
    const cart = decFromCart(addToCart(EMPTY_CART, "iphone"), "iphone");
    assert.deepEqual(cart.lines, []);
    assert.equal(cartQtyOf(cart, "iphone"), 0);
  });

  test("o'chirish qatorni soniga qaramay olib tashlaydi", () => {
    let cart = addToCart(EMPTY_CART, "iphone");
    cart = addToCart(cart, "iphone");
    cart = addToCart(cart, "dress");

    const after = removeFromCart(cart, "iphone");
    assert.deepEqual(after.lines, [{ productId: "dress", qty: 1 }]);
  });

  test("savatda yo'q mahsulotni kamaytirish hech narsani buzmaydi", () => {
    const cart = addToCart(EMPTY_CART, "dress");
    assert.deepEqual(decFromCart(cart, "iphone").lines, cart.lines);
    assert.deepEqual(removeFromCart(cart, "iphone").lines, cart.lines);
  });
});

describe("savatcha ekrani", () => {
  test("bo'sh savatcha katalogga yo'l ko'rsatadi", () => {
    const tree = deepShopTree();
    const view = cartView(tree, EMPTY_CART, null, req);

    assert.match(view.text, /bo'sh/);
    // Boshi berk ko'cha bo'lmasligi kerak: avval katalog, keyin navigatsiya.
    // `from === null` bo'lgani uchun «orqaga» allaqachon ildizga qaytaradi.
    assert.deepEqual(callbacks(view.markup), ["cb_shop", "nav:back:_"]);
  });

  test("qatorlar raqamlanadi va har biriga ➖ ➕ 🗑 beriladi", () => {
    const tree = deepShopTree();
    let cart = addToCart(EMPTY_CART, "iphone");
    cart = addToCart(cart, "iphone");
    const view = cartView(tree, cart, "electronics", req);

    assert.match(view.text, /1️⃣ iPhone 15 Pro/);
    assert.match(view.text, /2 × 12 500 000 so'm = 25 000 000 so'm/);
    assert.match(view.text, /2 ta mahsulot · Jami: 25 000 000 so'm/);

    assert.deepEqual(callbacks(view.markup), [
      NAV.cartCheckout,
      "cart:dec:cb_iphone",
      "cart:inc:cb_iphone",
      "cart:del:cb_iphone",
      // «➕ Mahsulot qo'shish» katalogga qaytaradi
      "cb_shop",
      NAV.cartClear,
      "nav:back:electronics",
      NAV.home,
    ]);
  });

  test("savatga sig'gan har bir qator boshqariladi", () => {
    // Saqlash chegarasi ko'rsatish chegarasiga teng bo'lishi kerak: aks holda
    // matnda ko'rinadigan, lekin 🗑 tugmasi bo'lmagan — ya'ni o'chirib
    // bo'lmaydigan — qator paydo bo'lardi.
    const products = Array.from({ length: MAX_CART_LINES + 5 }, (_, index) =>
      btn({
        id: `p${index}`,
        parentId: null,
        text: `Mahsulot ${index}`,
        actionType: "product",
        actionConfig: { price: 1000 },
      }),
    );
    const cart = products.reduce((acc, product) => addToCart(acc, product.id), EMPTY_CART);

    assert.equal(cart.lines.length, MAX_CART_LINES, "savat chegaradan oshmaydi");

    const view = cartView(products, cart, null, req);
    const removable = callbacks(view.markup).filter((data) => data.startsWith("cart:del:"));
    assert.equal(removable.length, cart.lines.length);
  });

  test("har bir mahsulot o'z qatori va o'z belgisini oladi", () => {
    const tree = deepShopTree();
    let cart = addToCart(EMPTY_CART, "iphone");
    cart = addToCart(cart, "dress");
    const view = cartView(tree, cart, null, req);

    assert.match(view.text, /1️⃣ iPhone 15 Pro/);
    assert.match(view.text, /2️⃣ Ko'ylak/);
    assert.ok(callbacks(view.markup).includes("cart:del:cb_dress"));
  });

  test("bir dona mahsulotda ortiqcha hisob ko'rsatilmaydi", () => {
    const tree = deepShopTree();
    const view = cartView(tree, addToCart(EMPTY_CART, "dress"), null, req);

    assert.match(view.text, /1 × 420 000 so'm/);
    assert.ok(!view.text.includes("="), "bir dona uchun «=» qo'shilmaydi");
  });
});

/*
  Summani KIM hisoblaydi (§P9).

  Savatda faqat `productId` va `qty` saqlanadi; narx har safar bazadagi
  tugma yozuvidan olinadi. Ya'ni foydalanuvchi summani o'zgartira olmaydi.
  Quyidagi testlar shu kafolatni mustahkamlaydi — kelajakda kimdir narxni
  savatga ko'chirsa, ular yiqiladi.
*/
describe("summa server tomonida hisoblanadi", () => {
  const tree = [
    btn({ id: "iphone", actionType: "product", actionConfig: { price: 1000, currency: "UZS" } }),
    btn({ id: "case", actionType: "product", actionConfig: { price: 50, currency: "UZS" } }),
  ];

  test("narx savatdan emas, DARAXTDAN olinadi", () => {
    // Savatga soxta narx maydonlari qo'shib ko'ramiz.
    const tampered = readCart({
      cart: {
        lines: [
          { productId: "iphone", qty: 1, price: 1, amount: 1, total: 1 },
        ],
      },
    });

    const lines = resolveCart(tree, tampered);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].amount, 1000, "soxta narx e'tiborga olinmadi");
    assert.equal(cartTotal(lines), 1000);
  });

  test("miqdor chegaradan oshirilmaydi", () => {
    const huge = readCart({ cart: { lines: [{ productId: "iphone", qty: 999999 }] } });
    assert.equal(huge.lines[0].qty, 99, "MAX_QTY bilan cheklandi");
    assert.equal(cartTotal(resolveCart(tree, huge)), 99_000);
  });

  test("manfiy va kasr miqdor rad etiladi yoki tuzatiladi", () => {
    const negative = readCart({ cart: { lines: [{ productId: "iphone", qty: -5 }] } });
    assert.deepEqual(negative.lines, [], "manfiy qator tashlandi");

    const fractional = readCart({ cart: { lines: [{ productId: "iphone", qty: 2.9 }] } });
    assert.equal(fractional.lines[0].qty, 2, "butunga tushdi");
  });

  test("qatorlar soni chegaralangan", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ productId: `p${i}`, qty: 1 }));
    const cart = readCart({ cart: { lines: many } });
    assert.equal(cart.lines.length, MAX_CART_LINES);
  });

  test("mavjud bo'lmagan mahsulot summaga qo'shilmaydi", () => {
    const cart = readCart({
      cart: { lines: [{ productId: "iphone", qty: 1 }, { productId: "yoq", qty: 50 }] },
    });
    const lines = resolveCart(tree, cart);
    assert.equal(lines.length, 1);
    assert.equal(cartTotal(lines), 1000, "yo'q mahsulot 0 qo'shdi");
  });

  test("narxsiz mahsulot 0 beradi, NaN emas", () => {
    const noPrice = [btn({ id: "free", actionType: "product", actionConfig: {} })];
    const cart = readCart({ cart: { lines: [{ productId: "free", qty: 3 }] } });
    const total = cartTotal(resolveCart(noPrice, cart));
    assert.equal(total, 0);
    assert.ok(Number.isFinite(total));
  });
});
