/** Avtomat holatini rang va lug'at kalitiga bog'laydi. */
export type AutomationStatus = "draft" | "published" | "disabled";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

export function statusTone(status: AutomationStatus): {
  tone: Tone;
  labelKey: "statusDraft" | "statusPublished" | "statusDisabled";
} {
  switch (status) {
    case "published":
      return { tone: "success", labelKey: "statusPublished" };
    case "disabled":
      return { tone: "neutral", labelKey: "statusDisabled" };
    default:
      return { tone: "warning", labelKey: "statusDraft" };
  }
}
