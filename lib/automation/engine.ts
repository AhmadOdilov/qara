import type { Action } from "@/lib/automation/types";
import { LIMITS } from "@/lib/automation/types";
import { evaluateCondition, type EventContext } from "@/lib/automation/conditions";
import type { Condition } from "@/lib/automation/types";

/**
 * Bajarish dvigateli (§P4 PHASE 6, 8, 9).
 *
 * Bu modul ham SOF: amallarni O'ZI bajarmaydi, balki bajaruvchini
 * (`ActionRunner`) chaqiradi. Shu sababli sikl himoyasi, chegaralar va
 * xato ushlash bazasiz test qilinadi.
 */

export type AutomationDefinition = {
  id: string;
  name: string;
  trigger: string;
  conditions: Condition | null;
  actions: Action[];
};

/** Bitta amalni bajaradigan funksiya. Xato tashlasa dvigatel ushlaydi. */
export type ActionRunner = (
  action: Action,
  context: EventContext,
) => Promise<void>;

/** Ichma-ich avtomatni yuklovchi — `start_automation` uchun. */
export type AutomationLoader = (
  automationId: string,
) => Promise<AutomationDefinition | null>;

export type ExecutionOutcome = {
  status: "completed" | "failed" | "skipped";
  actionsRun: number;
  depth: number;
  failedAction?: string;
  error?: string;
  /** Sikl yoki chegara sababli to'xtatilgan bo'lsa. */
  haltReason?: "max_depth" | "max_actions" | "timeout" | "cycle" | "stopped";
};

export type ExecuteOptions = {
  loadAutomation?: AutomationLoader;
  now?: () => number;
  limits?: { maxDepth: number; maxActions: number; timeoutMs: number };
};

/**
 * Avtomatni bajaradi.
 *
 * Uchta to'xtash sababi ataylab AJRATILGAN, chunki ular boshqa-boshqa
 * muammoni bildiradi: `cycle` — konfiguratsiya xatosi, `max_actions` —
 * juda uzun zanjir, `timeout` — sekin amal.
 */
export async function executeAutomation(
  automation: AutomationDefinition,
  context: EventContext,
  run: ActionRunner,
  options: ExecuteOptions = {},
): Promise<ExecutionOutcome> {
  const limits = options.limits ?? LIMITS;
  const now = options.now ?? (() => Date.now());
  const startedAt = now();

  // Shu ishga tushirishda ko'rilgan avtomatlar — A → B → A ni to'xtatadi.
  const visited = new Set<string>();
  const budget = { actions: 0 };

  const outcome = await runLevel({
    automation,
    context,
    run,
    depth: 0,
    visited,
    budget,
    limits,
    now,
    startedAt,
    loadAutomation: options.loadAutomation,
  });

  return outcome;
}

type LevelInput = {
  automation: AutomationDefinition;
  context: EventContext;
  run: ActionRunner;
  depth: number;
  visited: Set<string>;
  budget: { actions: number };
  limits: { maxDepth: number; maxActions: number; timeoutMs: number };
  now: () => number;
  startedAt: number;
  loadAutomation?: AutomationLoader;
};

async function runLevel(input: LevelInput): Promise<ExecutionOutcome> {
  const { automation, context, run, depth, visited, budget, limits, now } = input;

  // Shart bajarilmasa amallar umuman ishlamaydi — bu XATO emas.
  if (!evaluateCondition(context, automation.conditions)) {
    return { status: "skipped", actionsRun: budget.actions, depth };
  }

  if (visited.has(automation.id)) {
    return {
      status: "failed",
      actionsRun: budget.actions,
      depth,
      haltReason: "cycle",
      error: `Sikl aniqlandi: ${automation.id} qayta chaqirildi`,
    };
  }
  visited.add(automation.id);

  for (const action of automation.actions) {
    if (now() - input.startedAt > limits.timeoutMs) {
      return {
        status: "failed",
        actionsRun: budget.actions,
        depth,
        haltReason: "timeout",
        error: "Bajarish vaqti tugadi",
      };
    }

    if (budget.actions >= limits.maxActions) {
      return {
        status: "failed",
        actionsRun: budget.actions,
        depth,
        haltReason: "max_actions",
        error: `Amallar chegarasi (${limits.maxActions}) oshib ketdi`,
      };
    }

    if (action.type === "stop") {
      return {
        status: "completed",
        actionsRun: budget.actions,
        depth,
        haltReason: "stopped",
      };
    }

    if (action.type === "start_automation") {
      if (depth + 1 > limits.maxDepth) {
        return {
          status: "failed",
          actionsRun: budget.actions,
          depth,
          haltReason: "max_depth",
          error: `Chuqurlik chegarasi (${limits.maxDepth}) oshib ketdi`,
        };
      }

      const next = await input.loadAutomation?.(action.automationId);
      if (!next) {
        // Topilmagan avtomat — bu konfiguratsiya xatosi, jim o'tkazib
        // yubormaymiz, lekin butun zanjirni ham yiqitmaymiz.
        budget.actions += 1;
        continue;
      }

      const nested = await runLevel({ ...input, automation: next, depth: depth + 1 });
      if (nested.status === "failed") return nested;
      continue;
    }

    budget.actions += 1;
    try {
      await run(action, context);
    } catch (error) {
      // Bitta amalning xatosi butun tizimni yiqitmaydi — yozib qo'yamiz.
      return {
        status: "failed",
        actionsRun: budget.actions,
        depth,
        failedAction: action.type,
        error: error instanceof Error ? error.message : "Noma'lum xato",
      };
    }
  }

  return { status: "completed", actionsRun: budget.actions, depth };
}

/**
 * Amalni qayta urinish xavfsizmi.
 *
 * Xabar yuborish qayta urinilsa foydalanuvchi ikkita bir xil xabar oladi,
 * shuning uchun u qayta urinilmaydi. Teg qo'yish/olib tashlash esa
 * idempotent — natija bir xil.
 */
export function isRetryable(action: Action["type"]): boolean {
  return action === "add_tag" || action === "remove_tag";
}
