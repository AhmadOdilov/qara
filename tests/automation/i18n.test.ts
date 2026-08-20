import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dictionaries, LANGS } from "@/lib/i18n/dictionaries";
import { TEMPLATES } from "@/lib/automation/templates";
import { automationSchema, LIVE_ACTIONS, LIVE_TRIGGERS } from "@/lib/automation/types";

describe("tarjima to'liqligi", () => {
  it("automations bo'limi uch tilda bir xil kalitlarga ega", () => {
    const reference = Object.keys(dictionaries.uz.automations).sort();
    for (const lang of LANGS) {
      const keys = Object.keys(dictionaries[lang].automations).sort();
      assert.deepEqual(keys, reference, `${lang} kalitlari mos emas`);
    }
  });

  it("hech bir qiymat bo'sh emas", () => {
    for (const lang of LANGS) {
      const table = dictionaries[lang].automations as Record<string, string>;
      for (const [key, value] of Object.entries(table)) {
        assert.ok(value.trim().length > 0, `${lang}.${key} bo'sh`);
      }
    }
  });
});

describe("shablonlar faqat IMPLEMENTED imkoniyatlardan foydalanadi", () => {
  it("har bir shablon uch tilda sxemaga mos", () => {
    for (const template of TEMPLATES) {
      for (const lang of LANGS) {
        const built = template.build(lang);
        const parsed = automationSchema.safeParse(built);
        assert.ok(
          parsed.success,
          `${template.id} (${lang}) sxemaga mos emas: ${JSON.stringify(parsed.error?.issues)}`,
        );
      }
    }
  });

  it("faqat runtime'da ishlaydigan trigger ishlatiladi", () => {
    for (const template of TEMPLATES) {
      const built = template.build("uz");
      assert.ok(
        (LIVE_TRIGGERS as readonly string[]).includes(built.trigger),
        `${template.id}: ${built.trigger} qurilmagan`,
      );
    }
  });

  it("faqat runtime'da ishlaydigan amal ishlatiladi", () => {
    for (const template of TEMPLATES) {
      for (const action of template.build("uz").actions) {
        assert.ok(
          (LIVE_ACTIONS as readonly string[]).includes(action.type),
          `${template.id}: ${action.type} qurilmagan`,
        );
      }
    }
  });

  it("kalit so'z triggeri kalit so'zsiz qolmaydi", () => {
    for (const template of TEMPLATES) {
      for (const lang of LANGS) {
        const built = template.build(lang);
        if (built.trigger !== "keyword_received") continue;
        const keyword = String(
          (built.triggerConfig as { keyword?: unknown }).keyword ?? "",
        );
        assert.ok(keyword.trim().length > 0, `${template.id} (${lang}) kalit so'zsiz`);
      }
    }
  });
});

describe("sxema tekshiruvi", () => {
  it("amalsiz avtomat qabul qilinmaydi", () => {
    const result = automationSchema.safeParse({
      name: "test",
      trigger: "user_joined",
      actions: [],
    });
    assert.equal(result.success, false);
  });

  it("qurilmagan trigger qabul qilinmaydi", () => {
    const result = automationSchema.safeParse({
      name: "test",
      trigger: "scheduled",
      actions: [{ type: "send_message", text: "salom" }],
    });
    assert.equal(result.success, false, "scheduled hali ishlamaydi");
  });

  it("qurilmagan amal qabul qilinmaydi", () => {
    const result = automationSchema.safeParse({
      name: "test",
      trigger: "user_joined",
      actions: [{ type: "google_sheets_append", sheet: "x" }],
    });
    assert.equal(result.success, false);
  });

  it("nomsiz avtomat qabul qilinmaydi", () => {
    const result = automationSchema.safeParse({
      name: "   ",
      trigger: "user_joined",
      actions: [{ type: "send_message", text: "salom" }],
    });
    assert.equal(result.success, false);
  });
});
