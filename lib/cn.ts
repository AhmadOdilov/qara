/** Shartli class nomlarini birlashtiradi. */
export function cn(
  ...values: (string | false | null | undefined)[]
): string {
  return values.filter(Boolean).join(" ");
}
