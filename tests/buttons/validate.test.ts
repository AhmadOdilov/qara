import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { callbackFits, longestCallbackFor } from "../../lib/bots/buttons/callback";
import { isDescendant, subtreeIds } from "../../lib/bots/buttons/menu";
import { validateTree, type IssueCode } from "../../lib/bots/buttons/validate";
import type { ButtonRecord } from "../../lib/bots/buttons/types";
import { btn, deepShopTree, node, product } from "./helpers";

function codes(issues: { code: IssueCode }[]): IssueCode[] {
  return issues.map((issue) => issue.code);
}

describe("daraxt tekshiruvi", () => {
  test("to'g'ri daraxtda xato bo'lmaydi", () => {
    const result = validateTree(deepShopTree());
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.errors, []);
  });

  test("halqa aniqlanadi va nashrni to'xtatadi", () => {
    const tree: ButtonRecord[] = [
      node("a", "b"),
      node("b", "a"),
    ];
    const result = validateTree(tree);
    assert.equal(result.ok, false);
    assert.ok(codes(result.errors).includes("cycle"));
  });

  test("otasi yo'q tugma xato", () => {
    const result = validateTree([btn({ id: "x", parentId: "yo'q" })]);
    assert.equal(result.ok, false);
    assert.ok(codes(result.errors).includes("orphan"));
  });

  test("o'ziga ulangan menyu xato", () => {
    const result = validateTree([node("m", null, { targetId: "m" })]);
    assert.equal(result.ok, false);
    assert.ok(codes(result.errors).includes("self_target"));
  });

  test("o'z avlodiga ulangan menyu xato", () => {
    const tree = [node("m", null, { targetId: "child" }), node("child", "m")];
    const result = validateTree(tree);
    assert.equal(result.ok, false);
    assert.ok(codes(result.errors).includes("descendant_target"));
  });

  test("takrorlangan callback identifikatori xato", () => {
    const tree = [
      btn({ id: "a", callbackId: "cb_same" }),
      btn({ id: "b", callbackId: "cb_same" }),
    ];
    const result = validateTree(tree);
    assert.equal(result.ok, false);
    assert.ok(codes(result.errors).includes("duplicate_callback"));
  });

  test("uzun callback aniqlanadi", () => {
    const tree = [btn({ id: "a", callbackId: "b".repeat(70) })];
    const result = validateTree(tree);
    assert.equal(result.ok, false);
    assert.ok(codes(result.errors).includes("callback_too_long"));
  });
});

describe("ogohlantirishlar nashrni to'xtatmaydi", () => {
  test("yaroqsiz URL — ogohlantirish", () => {
    const tree = [btn({ id: "a", buttonType: "url", actionConfig: {} })];
    const result = validateTree(tree);
    assert.equal(result.ok, true);
    assert.ok(codes(result.warnings).includes("invalid_url"));
  });

  test("mavjud bo'lmagan menyuga ulash — ogohlantirish", () => {
    const result = validateTree([node("m", null, { targetId: "yo'q" })]);
    assert.equal(result.ok, true);
    assert.ok(codes(result.warnings).includes("missing_target"));
  });

  test("narxsiz mahsulot — ogohlantirish", () => {
    const tree = [node("m", null), btn({ id: "p", parentId: "m", actionType: "product" })];
    const result = validateTree(tree);
    assert.equal(result.ok, true);
    assert.ok(codes(result.warnings).includes("no_price"));
  });

  test("aralash klaviatura — ogohlantirish", () => {
    const tree = [
      node("m", null),
      btn({ id: "a", parentId: "m", keyboardKind: "inline" }),
      btn({ id: "b", parentId: "m", keyboardKind: "reply", buttonType: "text", rowIndex: 1 }),
    ];
    const result = validateTree(tree);
    assert.equal(result.ok, true);
    assert.ok(codes(result.warnings).includes("mixed_keyboard"));
  });

  test("bir qatorda ko'p tugma — ogohlantirish", () => {
    const tree: ButtonRecord[] = [node("m", null)];
    for (let i = 0; i < 10; i++) {
      tree.push(btn({ id: `b${i}`, parentId: "m", rowIndex: 0, sortOrder: i }));
    }
    const result = validateTree(tree);
    assert.equal(result.ok, true);
    assert.ok(codes(result.warnings).includes("row_too_wide"));
  });

  test("savatga qo'shish mavjud mahsulotga ulanishi kerak", () => {
    const withProduct = [
      node("m", null),
      product("p", "m", 1000),
      btn({ id: "add", parentId: "m", actionType: "add_to_cart", actionConfig: { productId: "p" } }),
    ];
    assert.deepEqual(validateTree(withProduct).warnings.filter((w) => w.code === "missing_product"), []);

    const withoutProduct = [
      node("m", null),
      btn({ id: "add", parentId: "m", actionType: "add_to_cart", actionConfig: { productId: "yo'q" } }),
    ];
    assert.ok(codes(validateTree(withoutProduct).warnings).includes("missing_product"));
  });
});

describe("callback cheklovi", () => {
  test("standart identifikator chegaraga sig'adi", () => {
    assert.ok(callbackFits(longestCallbackFor("btn_1a2b3c4d")));
  });

  test("48 belgidan uzun identifikator sig'maydi", () => {
    assert.ok(!callbackFits(longestCallbackFor("x".repeat(60))));
  });
});

describe("daraxt yordamchilari", () => {
  test("avlod aniqlanadi", () => {
    const tree = deepShopTree();
    assert.ok(isDescendant(tree, "shirts", "shop"));
    assert.ok(!isDescendant(tree, "shop", "shirts"));
  });

  test("ichki daraxt to'liq yig'iladi", () => {
    const tree = deepShopTree();
    assert.deepEqual(subtreeIds(tree, "clothing").sort(), [
      "clothing",
      "dress",
      "men",
      "shirt-classic",
      "shirt-slim",
      "shirts",
      "women",
    ]);
  });
});
