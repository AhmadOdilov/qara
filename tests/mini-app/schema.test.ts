/**
 * Mini App sxemasi va nashr tekshiruvi.
 *
 * Ikkalasi ham sof: baza kerak emas. Bu yerdagi asosiy savol — konstruktordan
 * kelgan BUZILGAN daraxt bazaga tusha oladimi va yaroqsiz ilova nashrga
 * chiqadimi. Ikkalasiga ham javob «yo'q» bo'lishi kerak.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  componentTreeSchema,
  defaultProps,
  flattenComponents,
  inputsOf,
  isHttpsUrl,
  MAX_COMPONENTS_PER_PAGE,
  newComponentId,
  type MiniAppComponent,
} from "../../lib/mini-app/schema";
import { validateSchema } from "../../lib/mini-app/service";
import type { MiniAppSchema } from "../../lib/mini-app/schema";

/* ── Yordamchilar ────────────────────────────────────────────────────────── */

function node<T extends MiniAppComponent["type"]>(
  type: T,
  props: Partial<Record<string, unknown>> = {},
): MiniAppComponent {
  return {
    id: newComponentId(type),
    type,
    props: { ...defaultProps(type), ...props },
  } as MiniAppComponent;
}

function app(overrides: Partial<MiniAppSchema> = {}): MiniAppSchema {
  return {
    id: "app1",
    name: "Do'kon",
    theme: { radius: 12 },
    settings: { headerTitle: "", mainButtonText: "", mainButtonAction: { kind: "none" } },
    pages: [
      { id: "p1", name: "Bosh", slug: "home", title: null, isHome: true, components: [] },
    ],
    ...overrides,
  };
}

/* ── Komponent sxemasi ──────────────────────────────────────────────────── */

describe("komponent daraxti", () => {
  test("standart sozlamalar to'liq keladi", () => {
    const button = defaultProps("button");
    assert.equal(button.variant, "primary");
    assert.equal(button.action.kind, "none");
    assert.equal(defaultProps("input").type, "text");
  });

  test("to'g'ri daraxt qabul qilinadi", () => {
    const tree = [node("heading", { text: "Salom" }), node("button")];
    assert.equal(componentTreeSchema.parse(tree).length, 2);
  });

  test("noma'lum tur rad etiladi", () => {
    const bad = [{ id: "x", type: "iframe", props: {} }];
    assert.throws(() => componentTreeSchema.parse(bad));
  });

  test("id'siz komponent rad etiladi", () => {
    assert.throws(() => componentTreeSchema.parse([{ type: "text", props: {} }]));
  });

  test("input nomi faqat harf/raqamdan iborat", () => {
    assert.throws(() =>
      componentTreeSchema.parse([node("input", { name: "yomon nom!" })]),
    );
  });

  test("juda uzun daraxt rad etiladi", () => {
    const many = Array.from({ length: MAX_COMPONENTS_PER_PAGE + 1 }, () => node("spacer"));
    assert.throws(() => componentTreeSchema.parse(many));
  });

  test("ichma-ich konteyner o'qiladi", () => {
    const tree: MiniAppComponent[] = [
      { ...node("container"), children: [node("text", { text: "ichkarida" })] },
    ];
    const parsed = componentTreeSchema.parse(tree);
    assert.equal(flattenComponents(parsed).length, 2);
  });

  test("forma maydonlari yig'iladi", () => {
    const tree: MiniAppComponent[] = [
      node("input", { name: "ism" }),
      { ...node("container"), children: [node("input", { name: "telefon" })] },
    ];
    assert.deepEqual(
      inputsOf(tree).map((input) => input.name),
      ["ism", "telefon"],
    );
  });

  test("faqat HTTPS manzil qabul qilinadi", () => {
    assert.equal(isHttpsUrl("https://example.com"), true);
    assert.equal(isHttpsUrl("http://example.com"), false);
    assert.equal(isHttpsUrl("javascript:alert(1)"), false);
    assert.equal(isHttpsUrl(""), false);
  });
});

/* ── Nashr tekshiruvi ────────────────────────────────────────────────────── */

describe("nashr tekshiruvi", () => {
  test("to'g'ri ilovada muammo yo'q", () => {
    assert.deepEqual(validateSchema(app()), []);
  });

  test("sahifasiz ilova nashr etilmaydi", () => {
    const issues = validateSchema(app({ pages: [] }));
    assert.ok(issues.some((issue) => issue.code === "no_pages"));
  });

  test("bosh sahifasiz ilova nashr etilmaydi", () => {
    const issues = validateSchema(
      app({
        pages: [
          { id: "p1", name: "A", slug: "a", title: null, isHome: false, components: [] },
        ],
      }),
    );
    assert.ok(issues.some((issue) => issue.code === "no_home"));
  });

  test("mavjud bo'lmagan sahifaga ulangan tugma aniqlanadi", () => {
    const issues = validateSchema(
      app({
        pages: [
          {
            id: "p1",
            name: "Bosh",
            slug: "home",
            title: null,
            isHome: true,
            components: [
              node("button", { text: "Ket", action: { kind: "open_page", page: "yoq" } }),
            ],
          },
        ],
      }),
    );
    assert.ok(issues.some((issue) => issue.code === "missing_page"));
  });

  test("mavjud sahifaga ulangan tugma o'tadi", () => {
    const issues = validateSchema(
      app({
        pages: [
          {
            id: "p1",
            name: "Bosh",
            slug: "home",
            title: null,
            isHome: true,
            components: [
              node("button", { action: { kind: "open_page", page: "home" } }),
            ],
          },
        ],
      }),
    );
    assert.deepEqual(issues, []);
  });

  test("HTTPS bo'lmagan havola aniqlanadi", () => {
    const issues = validateSchema(
      app({
        pages: [
          {
            id: "p1",
            name: "Bosh",
            slug: "home",
            title: null,
            isHome: true,
            components: [
              node("button", { action: { kind: "open_url", url: "http://yomon.uz" } }),
            ],
          },
        ],
      }),
    );
    assert.ok(issues.some((issue) => issue.code === "invalid_url"));
  });

  test("ichma-ich joylashgan tugma ham tekshiriladi", () => {
    const issues = validateSchema(
      app({
        pages: [
          {
            id: "p1",
            name: "Bosh",
            slug: "home",
            title: null,
            isHome: true,
            components: [
              {
                ...node("container"),
                children: [node("button", { action: { kind: "open_page", page: "yoq" } })],
              },
            ],
          },
        ],
      }),
    );
    assert.ok(issues.some((issue) => issue.code === "missing_page"));
  });

  test("mahsulot tugmasining amali ham tekshiriladi", () => {
    const issues = validateSchema(
      app({
        pages: [
          {
            id: "p1",
            name: "Bosh",
            slug: "home",
            title: null,
            isHome: true,
            components: [
              node("product", { action: { kind: "open_page", page: "yoq" } }),
            ],
          },
        ],
      }),
    );
    assert.ok(issues.some((issue) => issue.code === "missing_page"));
  });
});
