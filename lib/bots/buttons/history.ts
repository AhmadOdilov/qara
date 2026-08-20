/**
 * Konstruktor tarixi — Undo / Redo (§P2).
 *
 * NEGA SNAPSHOT EMAS. Bu konstruktorda klient tomonda qoralama buferi yo'q:
 * har bir o'zgarish darhol API'ga ketadi va holat serverdan qayta o'qiladi
 * (`button-builder.tsx` dagi `run()` → `refresh()`). Ya'ni SERVERNING O'ZI
 * qoralama. Shu sababli undo — mahalliy holatni orqaga qaytarish emas,
 * TESKARI AMALNI bajarish.
 *
 * Bu modul sof: tarmoq ham, React ham yo'q. Amallarni bajarish
 * konstruktorda, bu yerda esa faqat stek mantig'i — shuning uchun uni
 * to'liq test qilish mumkin.
 */

/** Bitta tugmaning API'ga yuboriladigan to'liq tavsifi. */
export type ButtonPayload = {
  text: string;
  emoji: string | null;
  parentId: string | null;
  keyboardKind: string;
  buttonType: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  rowIndex: number;
  visibility: Record<string, unknown>;
  conditions: unknown[];
  enabled: boolean;
  adminOnly: boolean;
};

/** Ko'chirish so'rovining bitta elementi. */
export type MoveItem = {
  id: string;
  parentId: string | null;
  rowIndex: number;
  sortOrder: number;
};

/**
 * O'chirilgan tugmani qayta tiklash uchun yozuv.
 *
 * `oldId` — o'chirilgan tugmaning avvalgi identifikatori. Yangi tugma yangi
 * id oladi, shuning uchun bola tugmalarning `parentId` si tiklash vaqtida
 * eski → yangi jadval orqali qayta bog'lanadi.
 */
export type RestoreNode = {
  oldId: string;
  oldParentId: string | null;
  payload: ButtonPayload;
};

export type BuilderOp =
  | { kind: "create"; payload: ButtonPayload }
  | { kind: "update"; id: string; payload: ButtonPayload }
  | { kind: "delete"; id: string }
  | { kind: "move"; items: MoveItem[] }
  | { kind: "restore"; nodes: RestoreNode[] };

/** Lug'atdagi `builder.hist*` kaliti — tarix yozuvining nomi. */
export type HistoryLabel =
  | "histCreate"
  | "histUpdate"
  | "histDelete"
  | "histMove"
  | "histDuplicate";

export type HistoryEntry = {
  label: HistoryLabel;
  undo: BuilderOp;
  redo: BuilderOp;
};

export type History = {
  entries: HistoryEntry[];
  /** Oxirgi BAJARILGAN yozuv indeksi. `-1` — bekor qilinadigan narsa yo'q. */
  index: number;
};

/**
 * Tarix chegarasi. Xotira cheksiz o'smasin: har bir yozuv o'chirilgan
 * ostdaraxtni ham saqlashi mumkin.
 */
export const HISTORY_LIMIT = 50;

export const EMPTY_HISTORY: History = { entries: [], index: -1 };

export function canUndo(history: History): boolean {
  return history.index >= 0;
}

export function canRedo(history: History): boolean {
  return history.index < history.entries.length - 1;
}

/**
 * Yangi yozuvni qo'shadi.
 *
 * Undo qilingandan keyin yangi o'zgarish kiritilsa, oldinga qarab turgan
 * shox (redo tarixi) o'chadi — chunki u endi boshqa holatga tegishli va
 * uni qayta bajarish daraxtni buzardi.
 */
export function pushEntry(
  history: History,
  entry: HistoryEntry,
  limit = HISTORY_LIMIT,
): History {
  const kept = history.entries.slice(0, history.index + 1);
  kept.push(entry);

  const overflow = Math.max(0, kept.length - limit);
  const entries = overflow > 0 ? kept.slice(overflow) : kept;

  return { entries, index: entries.length - 1 };
}

/** Bekor qilinadigan yozuv va undan keyingi tarix holati. */
export function undoStep(
  history: History,
): { history: History; entry: HistoryEntry; at: number } | null {
  if (!canUndo(history)) return null;
  const at = history.index;
  return {
    history: { entries: history.entries, index: at - 1 },
    entry: history.entries[at],
    at,
  };
}

/** Qayta bajariladigan yozuv va undan keyingi tarix holati. */
export function redoStep(
  history: History,
): { history: History; entry: HistoryEntry; at: number } | null {
  if (!canRedo(history)) return null;
  const at = history.index + 1;
  return {
    history: { entries: history.entries, index: at },
    entry: history.entries[at],
    at,
  };
}

/**
 * Yozuvni yangilaydi.
 *
 * Yaratish va tiklash amallarida server YANGI id beradi, ya'ni juftlikdagi
 * teskari amal eskirib qoladi. Amal bajarilgach yozuv aynan shu funksiya
 * bilan yangi id'ga moslanadi — aks holda ikkinchi undo mavjud bo'lmagan
 * tugmani o'chirishga urinardi.
 */
export function patchEntry(
  history: History,
  at: number,
  entry: HistoryEntry,
): History {
  if (at < 0 || at >= history.entries.length) return history;
  const entries = history.entries.slice();
  entries[at] = entry;
  return { entries, index: history.index };
}

/* ── Amal yordamchilari ──────────────────────────────────────────────────── */

/**
 * O'chirilayotgan ostdaraxtni tiklash yozuviga aylantiradi.
 *
 * Tartib MUHIM: ota tugma bolasidan oldin turishi kerak, aks holda tiklashda
 * bolaning `parentId` si hali mavjud bo'lmagan tugmaga ishora qilardi.
 */
export function toRestoreNodes(
  nodes: { id: string; parentId: string | null; payload: ButtonPayload }[],
  rootId: string,
): RestoreNode[] {
  const byParent = new Map<string | null, typeof nodes>();
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }

  const ordered: RestoreNode[] = [];
  const root = nodes.find((node) => node.id === rootId);
  if (!root) return ordered;

  // Kengligiga qarab yurish — har bir daraja otasidan keyin qo'shiladi.
  const queue = [root];
  while (queue.length > 0) {
    const node = queue.shift() as (typeof nodes)[number];
    ordered.push({
      oldId: node.id,
      oldParentId: node.parentId,
      payload: node.payload,
    });
    queue.push(...(byParent.get(node.id) ?? []));
  }

  return ordered;
}

/**
 * Tiklash paytida `parentId` ni eski id'dan yangisiga o'giradi.
 *
 * Ostdaraxtning ildizi tashqaridagi (o'chirilmagan) otaga bog'langan
 * bo'ladi — u jadvalda bo'lmaydi va o'z qiymatida qoladi.
 */
export function remapParent(
  oldParentId: string | null,
  idMap: Map<string, string>,
): string | null {
  if (oldParentId === null) return null;
  return idMap.get(oldParentId) ?? oldParentId;
}
