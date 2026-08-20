export type BotStatusValue = "active" | "setup_required" | "error" | "disabled";

type Tone = "neutral" | "accent" | "success" | "danger";

/**
 * Bot holatini rang va lug'at kalitiga bog'laydi. Ro'yxat va sozlash
 * sahifasi bir xil ko'rinish berishi uchun bitta joyda turadi.
 */
export function statusTone(status: BotStatusValue): {
  tone: Tone;
  labelKey: "statusActive" | "statusSetupRequired" | "statusError" | "statusDisabled";
} {
  switch (status) {
    case "active":
      return { tone: "success", labelKey: "statusActive" };
    case "error":
      return { tone: "danger", labelKey: "statusError" };
    case "disabled":
      return { tone: "neutral", labelKey: "statusDisabled" };
    default:
      return { tone: "accent", labelKey: "statusSetupRequired" };
  }
}
