import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRedo,
  canUndo,
  EMPTY_HISTORY,
  patchEntry,
  pushEntry,
  redoStep,
  remapParent,
  toRestoreNodes,
  undoStep,
  type ButtonPayload,
  type HistoryEntry,
} from "@/lib/bots/buttons/history";

const PAYLOAD: ButtonPayload = {
  text: "Menyu",
  emoji: null,
  parentId: null,
  keyboardKind: "inline",
  buttonType: "callback",
  actionType: "send_message",
  actionConfig: {},
  rowIndex: 0,
  visibility: { audience: "everyone", tags: [] },
  conditions: [],
  enabled: true,
  adminOnly: false,
};

/** Nomi bo'yicha ajratib turadigan soxta yozuv. */
function entry(name: string): HistoryEntry {
  return {
    label: "histUpdate",
    undo: { kind: "update", id: name, payload: PAYLOAD },
    redo: { kind: "update", id: `${name}'`, payload: PAYLOAD },
  };
}

/** Tarixdagi yozuv nomlari — tekshirishni o'qish oson bo'lsin. */
function names(history: { entries: HistoryEntry[] }): string[] {
  return history.entries.map((item) =>
    item.undo.kind === "update" ? item.undo.id : item.undo.kind,
  );
}

describe("tarix steki", () => {
  it("bo'sh tarixda undo ham, redo ham yo'q", () => {
    assert.equal(canUndo(EMPTY_HISTORY), false);
    assert.equal(canRedo(EMPTY_HISTORY), false);
    assert.equal(undoStep(EMPTY_HISTORY), null);
    assert.equal(redoStep(EMPTY_HISTORY), null);
  });

  it("yozuv qo'shilgach undo mumkin, redo yo'q", () => {
    const history = pushEntry(EMPTY_HISTORY, entry("A"));
    assert.equal(canUndo(history), true);
    assert.equal(canRedo(history), false);
    assert.equal(history.index, 0);
  });

  it("A→B→C→D dan keyin undo teskari tartibda yuradi", () => {
    let history = EMPTY_HISTORY;
    for (const name of ["A", "B", "C", "D"]) {
      history = pushEntry(history, entry(name));
    }

    const first = undoStep(history);
    assert.ok(first);
    assert.equal(first.entry.undo.kind === "update" && first.entry.undo.id, "D");

    const second = undoStep(first.history);
    assert.ok(second);
    assert.equal(second.entry.undo.kind === "update" && second.entry.undo.id, "C");

    const third = undoStep(second.history);
    assert.ok(third);
    assert.equal(third.entry.undo.kind === "update" && third.entry.undo.id, "B");
  });

  it("undo qilingandan keyin redo o'sha yozuvni qaytaradi", () => {
    let history = pushEntry(EMPTY_HISTORY, entry("A"));
    history = pushEntry(history, entry("B"));
    history = pushEntry(history, entry("C"));

    const undone = undoStep(history);
    assert.ok(undone);
    assert.equal(canRedo(undone.history), true);

    const redone = redoStep(undone.history);
    assert.ok(redone);
    assert.equal(redone.entry.redo.kind === "update" && redone.entry.redo.id, "C'");
    assert.equal(redone.history.index, 2);
    assert.equal(canRedo(redone.history), false);
  });

  it("undo'dan keyin yangi o'zgarish redo shoxini o'chiradi", () => {
    let history = pushEntry(EMPTY_HISTORY, entry("A"));
    history = pushEntry(history, entry("B"));
    history = pushEntry(history, entry("C"));

    const undone = undoStep(history);
    assert.ok(undone);
    assert.deepEqual(names(undone.history), ["A", "B", "C"]);

    // B holatida turib yangi amal — C endi qayta bajarilmasligi kerak.
    const branched = pushEntry(undone.history, entry("X"));
    assert.deepEqual(names(branched), ["A", "B", "X"]);
    assert.equal(canRedo(branched), false);
    assert.equal(branched.index, 2);
  });

  it("ketma-ket ikki undo'dan keyin ham shox to'g'ri kesiladi", () => {
    let history = EMPTY_HISTORY;
    for (const name of ["A", "B", "C", "D"]) {
      history = pushEntry(history, entry(name));
    }
    const one = undoStep(history);
    assert.ok(one);
    const two = undoStep(one.history);
    assert.ok(two);

    const branched = pushEntry(two.history, entry("X"));
    assert.deepEqual(names(branched), ["A", "B", "X"]);
  });

  it("chegaradan oshganda eng eski yozuv tashlanadi", () => {
    let history = EMPTY_HISTORY;
    for (const name of ["A", "B", "C", "D", "E"]) {
      history = pushEntry(history, entry(name), 3);
    }
    assert.deepEqual(names(history), ["C", "D", "E"]);
    assert.equal(history.index, 2);
    assert.equal(canRedo(history), false);
  });

  it("patchEntry faqat bitta yozuvni almashtiradi va indeksga tegmaydi", () => {
    let history = pushEntry(EMPTY_HISTORY, entry("A"));
    history = pushEntry(history, entry("B"));

    const patched = patchEntry(history, 0, entry("Z"));
    assert.deepEqual(names(patched), ["Z", "B"]);
    assert.equal(patched.index, history.index);
  });

  it("patchEntry chegaradan tashqarida hech narsa qilmaydi", () => {
    const history = pushEntry(EMPTY_HISTORY, entry("A"));
    assert.deepEqual(names(patchEntry(history, 5, entry("Z"))), ["A"]);
    assert.deepEqual(names(patchEntry(history, -1, entry("Z"))), ["A"]);
  });
});

describe("o'chirilgan ostdaraxtni tiklash", () => {
  const nodes = [
    { id: "root", parentId: "outside", payload: PAYLOAD },
    { id: "child-1", parentId: "root", payload: PAYLOAD },
    { id: "child-2", parentId: "root", payload: PAYLOAD },
    { id: "grandchild", parentId: "child-1", payload: PAYLOAD },
  ];

  it("ota bolasidan OLDIN turadi", () => {
    const ordered = toRestoreNodes(nodes, "root");
    const position = new Map(ordered.map((node, index) => [node.oldId, index]));

    assert.equal(ordered.length, 4);
    assert.ok(
      (position.get("root") as number) < (position.get("child-1") as number),
      "ildiz bolasidan oldin",
    );
    assert.ok(
      (position.get("child-1") as number) < (position.get("grandchild") as number),
      "bola nabirasidan oldin",
    );
  });

  it("ildiz topilmasa bo'sh ro'yxat", () => {
    assert.deepEqual(toRestoreNodes(nodes, "yoq"), []);
  });

  it("remapParent eski id'ni yangisiga o'giradi", () => {
    const map = new Map([["root", "new-root"]]);
    assert.equal(remapParent("root", map), "new-root");
  });

  it("ostdaraxtdan tashqaridagi ota o'z qiymatida qoladi", () => {
    const map = new Map([["root", "new-root"]]);
    assert.equal(remapParent("outside", map), "outside");
    assert.equal(remapParent(null, map), null);
  });
});
