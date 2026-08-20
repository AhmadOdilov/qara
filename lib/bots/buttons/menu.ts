/**
 * Menyu daraxti ustidagi sof yordamchilar.
 *
 * MODEL: menyu tuguni alohida jadval emas — `submenu`/`category` tugmasining
 * O'ZI tugun bo'lib turadi. `parentId` daraxtni beradi (istalgan chuqurlik),
 * tugunning sarlavhasi/tavsifi/joylashuvi esa shu tugmaning `actionConfig`
 * ichida (`MenuConfig`). Ildiz menyusi — `parentId === null` bo'lgan tugmalar
 * to'plami va u `menuId === null` bilan belgilanadi.
 *
 * Nima uchun shunday: nashr surati, versiya tarixi va tiklash mexanizmi
 * bitta daraxt ustida ishlaydi. Ikkinchi jadval qo'shilsa, o'sha uch narsa
 * ham ikkiga bo'linardi va ikkita nesting mexanizmi paydo bo'lardi.
 *
 * Bu fayl klientda ham ishlatiladi (konstruktor daraxti va preview) — sof
 * funksiyalar, sir yo'q, `server-only` emas.
 */

import {
  buttonLabel,
  menuConfig,
  opensMenu,
  type ButtonRecord,
  type MenuConfig,
} from "@/lib/bots/buttons/types";

/** Chuqur daraxtda ham to'xtashi kafolatlangan yurish chegarasi. */
const MAX_DEPTH = 30;

/* ── Tugunlar ────────────────────────────────────────────────────────────── */

/** Menyu egasi bo'lgan tugma. Ildiz uchun — `null`. */
export function menuOwner(
  all: ButtonRecord[],
  menuId: string | null,
): ButtonRecord | null {
  if (!menuId) return null;
  return all.find((button) => button.id === menuId) ?? null;
}

export function menuExists(all: ButtonRecord[], menuId: string | null): boolean {
  return menuId === null || all.some((button) => button.id === menuId);
}

/** Menyu ichidagi tugmalar — ko'rinish qoidalari qo'llanmasdan, tartiblangan. */
export function childrenOf(all: ButtonRecord[], menuId: string | null): ButtonRecord[] {
  return all
    .filter((button) => button.parentId === menuId)
    .sort((a, b) => a.rowIndex - b.rowIndex || a.sortOrder - b.sortOrder);
}

/** Tugma ichki menyu ochadimi (o'z bolalari yoki ulangan menyu orqali). */
export function isMenuButton(all: ButtonRecord[], button: ButtonRecord): boolean {
  if (opensMenu(button.actionType)) return true;
  if (button.buttonType === "submenu") return true;
  return all.some((child) => child.parentId === button.id);
}

/**
 * Tugma bosilganda qaysi menyu ochilishi kerak.
 *
 * `targetId` boshqa tugunga ulash imkonini beradi (§3 «Target menu») — masalan
 * bir nechta joydan bitta «Elektronika» menyusiga kirish. Manzil yaroqsiz
 * bo'lsa tugmaning o'z bolalariga qaytadi: jonli bot hech qachon bo'sh
 * ekranga tushib qolmaydi.
 */
export function resolveMenuTarget(
  all: ButtonRecord[],
  button: ButtonRecord,
): string {
  const target = menuConfig(button).targetId;
  if (!target || target === button.id) return button.id;
  if (!all.some((candidate) => candidate.id === target)) return button.id;
  // Halqa: manzil tugmaning o'z avlodi bo'lsa, ochilgan menyu o'zini qayta
  // ochib cheksiz aylanardi.
  if (isDescendant(all, target, button.id)) return button.id;
  return target;
}

/* ── Yo'l va chuqurlik ───────────────────────────────────────────────────── */

/** Ildizdan menyugacha bo'lgan tugmalar zanjiri (menyu egasi ham kiradi). */
export function menuPath(all: ButtonRecord[], menuId: string | null): ButtonRecord[] {
  const path: ButtonRecord[] = [];
  let current = menuOwner(all, menuId);
  for (let depth = 0; current && depth < MAX_DEPTH; depth++) {
    path.unshift(current);
    current = current.parentId ? menuOwner(all, current.parentId) : null;
  }
  return path;
}

/** Ildiz — 0, ildizdagi tugmaning menyusi — 1 va h.k. */
export function menuDepth(all: ButtonRecord[], menuId: string | null): number {
  return menuPath(all, menuId).length;
}

/** `candidate` `ancestorId` ning avlodimi (o'zi ham hisoblanadi). */
export function isDescendant(
  all: ButtonRecord[],
  candidate: string,
  ancestorId: string,
): boolean {
  let current: string | null = candidate;
  for (let depth = 0; current && depth < MAX_DEPTH; depth++) {
    if (current === ancestorId) return true;
    current = all.find((button) => button.id === current)?.parentId ?? null;
  }
  return false;
}

/** Tugma va uning butun ichki daraxti. */
export function subtreeIds(all: ButtonRecord[], rootId: string): string[] {
  const ids = [rootId];
  for (let index = 0; index < ids.length && index < 10_000; index++) {
    for (const child of all) {
      if (child.parentId === ids[index]) ids.push(child.id);
    }
  }
  return ids;
}

/* ── Tugun sozlamalari ───────────────────────────────────────────────────── */

export function menuSettings(
  all: ButtonRecord[],
  menuId: string | null,
): MenuConfig {
  const owner = menuOwner(all, menuId);
  return owner ? menuConfig(owner) : {};
}

/**
 * Qatordagi tugma soni. `null` — konstruktorda qo'lda qo'yilgan `rowIndex`
 * bo'yicha guruhlash (eski xatti-harakat saqlanadi).
 */
export function layoutOf(all: ButtonRecord[], menuId: string | null): number | null {
  const layout = menuSettings(all, menuId).layout;
  if (typeof layout !== "number" || !Number.isFinite(layout)) return null;
  return Math.min(8, Math.max(1, Math.trunc(layout)));
}

/**
 * Menyu sarlavhasi — Telegram xabarining matni.
 *
 * Tugma matni zaxira sifatida ishlatiladi, shuning uchun sarlavha yozilmagan
 * menyu ham bo'sh xabar bilan chiqmaydi.
 */
export function menuHeading(
  all: ButtonRecord[],
  menuId: string | null,
  fallback: string,
): string {
  const owner = menuOwner(all, menuId);
  if (!owner) return fallback;

  const config = menuConfig(owner);
  const title = config.title?.trim() || buttonLabel(owner);
  const description = config.description?.trim();
  return description ? `${title}\n\n${description}` : title;
}
