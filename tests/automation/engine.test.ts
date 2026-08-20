import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  executeAutomation,
  isRetryable,
  type AutomationDefinition,
} from "@/lib/automation/engine";
import type { EventContext } from "@/lib/automation/conditions";
import type { Action } from "@/lib/automation/types";

const CTX: EventContext = {
  event: { name: "button_clicked" },
  user: { telegramUserId: "42", tags: ["new"], messageCount: 3 },
  order: { code: "AB12CD", amount: 600_000, currency: "UZS" },
};

const LIMITS = { maxDepth: 3, maxActions: 20, timeoutMs: 10_000 };

function automation(
  id: string,
  actions: Action[],
  conditions: AutomationDefinition["conditions"] = null,
): AutomationDefinition {
  return { id, name: id, trigger: "button_clicked", conditions, actions };
}

/** Bajarilgan amallarni yozib boradigan runner. */
function recorder() {
  const seen: string[] = [];
  return {
    seen,
    run: async (action: Action) => {
      seen.push(action.type);
    },
  };
}

describe("oddiy bajarish", () => {
  it("barcha amallar tartib bilan bajariladi", async () => {
    const { seen, run } = recorder();
    const result = await executeAutomation(
      automation("a", [
        { type: "add_tag", tag: "vip" },
        { type: "send_message", text: "salom" },
      ]),
      CTX,
      run,
      { limits: LIMITS },
    );

    assert.equal(result.status, "completed");
    assert.equal(result.actionsRun, 2);
    assert.deepEqual(seen, ["add_tag", "send_message"]);
  });

  it("shart bajarilmasa amallar ISHLAMAYDI va bu xato emas", async () => {
    const { seen, run } = recorder();
    const result = await executeAutomation(
      automation("a", [{ type: "send_message", text: "salom" }], {
        op: "and",
        rules: [{ field: "order.amount", operator: "greater_than", value: 900_000 }],
      }),
      CTX,
      run,
      { limits: LIMITS },
    );

    assert.equal(result.status, "skipped");
    assert.deepEqual(seen, []);
  });

  it("shart bajarilsa amallar ishlaydi", async () => {
    const { seen, run } = recorder();
    const result = await executeAutomation(
      automation("a", [{ type: "notify_admin", text: "katta buyurtma" }], {
        op: "and",
        rules: [{ field: "order.amount", operator: "greater_than", value: 500_000 }],
      }),
      CTX,
      run,
      { limits: LIMITS },
    );

    assert.equal(result.status, "completed");
    assert.deepEqual(seen, ["notify_admin"]);
  });

  it("`stop` qolgan amallarni to'xtatadi", async () => {
    const { seen, run } = recorder();
    const result = await executeAutomation(
      automation("a", [
        { type: "add_tag", tag: "x" },
        { type: "stop" },
        { type: "send_message", text: "bu ketmaydi" },
      ]),
      CTX,
      run,
      { limits: LIMITS },
    );

    assert.equal(result.status, "completed");
    assert.equal(result.haltReason, "stopped");
    assert.deepEqual(seen, ["add_tag"]);
  });
});

describe("cheksiz sikldan himoya", () => {
  it("A → B → A zanjiri to'xtatiladi", async () => {
    const a = automation("a", [{ type: "start_automation", automationId: "b" }]);
    const b = automation("b", [{ type: "start_automation", automationId: "a" }]);
    const registry = new Map([
      ["a", a],
      ["b", b],
    ]);

    const { seen, run } = recorder();
    const result = await executeAutomation(a, CTX, run, {
      limits: LIMITS,
      loadAutomation: async (id) => registry.get(id) ?? null,
    });

    assert.equal(result.status, "failed");
    assert.equal(result.haltReason, "cycle");
    assert.deepEqual(seen, [], "sikl amallarni bajarishga ulgurmaydi");
  });

  it("o'zini chaqiradigan avtomat ham to'xtatiladi", async () => {
    const a = automation("a", [{ type: "start_automation", automationId: "a" }]);
    const { run } = recorder();
    const result = await executeAutomation(a, CTX, run, {
      limits: LIMITS,
      loadAutomation: async () => a,
    });
    assert.equal(result.haltReason, "cycle");
  });

  it("chuqurlik chegarasi hurmat qilinadi", async () => {
    // Har biri keyingisini chaqiradigan uzun zanjir — sikl EMAS.
    const chain = new Map<string, AutomationDefinition>();
    for (let i = 0; i < 8; i += 1) {
      chain.set(
        `n${i}`,
        automation(`n${i}`, [{ type: "start_automation", automationId: `n${i + 1}` }]),
      );
    }

    const { run } = recorder();
    const result = await executeAutomation(
      chain.get("n0") as AutomationDefinition,
      CTX,
      run,
      {
        limits: { ...LIMITS, maxDepth: 2 },
        loadAutomation: async (id) => chain.get(id) ?? null,
      },
    );

    assert.equal(result.status, "failed");
    assert.equal(result.haltReason, "max_depth");
  });

  it("amallar chegarasi oshsa to'xtaydi", async () => {
    const many: Action[] = Array.from({ length: 10 }, (_, i) => ({
      type: "add_tag" as const,
      tag: `t${i}`,
    }));
    const { seen, run } = recorder();
    const result = await executeAutomation(automation("a", many), CTX, run, {
      limits: { ...LIMITS, maxActions: 4 },
    });

    assert.equal(result.status, "failed");
    assert.equal(result.haltReason, "max_actions");
    assert.equal(seen.length, 4, "chegaradan keyin hech narsa bajarilmaydi");
  });

  it("vaqt chegarasi oshsa to'xtaydi", async () => {
    let clock = 0;
    const { run } = recorder();
    const result = await executeAutomation(
      automation("a", [
        { type: "add_tag", tag: "a" },
        { type: "add_tag", tag: "b" },
      ]),
      CTX,
      run,
      {
        limits: { ...LIMITS, timeoutMs: 100 },
        // Har chaqiruvda soat oldinga siljiydi.
        now: () => {
          clock += 80;
          return clock;
        },
      },
    );

    assert.equal(result.status, "failed");
    assert.equal(result.haltReason, "timeout");
  });
});

describe("xatolarni ushlash", () => {
  it("bitta amal yiqilsa qaysi biri ekani yoziladi", async () => {
    const result = await executeAutomation(
      automation("a", [
        { type: "add_tag", tag: "ok" },
        { type: "call_webhook", url: "https://example.com/hook" },
        { type: "send_message", text: "bu ketmaydi" },
      ]),
      CTX,
      async (action) => {
        if (action.type === "call_webhook") throw new Error("tarmoq uzildi");
      },
      { limits: LIMITS },
    );

    assert.equal(result.status, "failed");
    assert.equal(result.failedAction, "call_webhook");
    assert.equal(result.error, "tarmoq uzildi");
    assert.equal(result.actionsRun, 2, "yiqilgan amal ham sanaladi");
  });

  it("topilmagan ichki avtomat butun zanjirni yiqitmaydi", async () => {
    const { seen, run } = recorder();
    const result = await executeAutomation(
      automation("a", [
        { type: "start_automation", automationId: "yoq" },
        { type: "add_tag", tag: "davom" },
      ]),
      CTX,
      run,
      { limits: LIMITS, loadAutomation: async () => null },
    );

    assert.equal(result.status, "completed");
    assert.deepEqual(seen, ["add_tag"]);
  });
});

describe("qayta urinish xavfsizligi", () => {
  it("faqat idempotent amallar qayta urinadi", () => {
    assert.equal(isRetryable("add_tag"), true);
    assert.equal(isRetryable("remove_tag"), true);
    assert.equal(isRetryable("send_message"), false, "ikkinchi xabar ketmasin");
    assert.equal(isRetryable("notify_admin"), false);
    assert.equal(isRetryable("call_webhook"), false, "tashqi ta'sir takrorlanmasin");
  });
});
