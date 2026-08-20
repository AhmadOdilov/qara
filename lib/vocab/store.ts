"use client";

import { STORAGE_KEY, type TestState } from "./session";

/**
 * Test holati uchun tashqi do'kon (`useSyncExternalStore` uchun).
 *
 * Yagona haqiqat manbai — localStorage. React holati undan o'qiladi, shuning
 * uchun sahifa yangilanganda ham hech narsa yo'qolmaydi va boshqa tabdagi
 * o'zgarish ham darhol ko'rinadi.
 *
 * Xotirada `cached` saqlanadi: private rejimda yoki xotira to'lganda
 * localStorage yozmay qo'yishi mumkin — bunday holatda ham test seansi
 * (kamida shu tab uchun) buzilmasdan davom etadi.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let cached: string | null = null;
let loaded = false;

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cached = readStorage();
    loaded = true;
    emit();
  };

  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Barqaror snapshot: bir xil holatda har doim bir xil satr qaytadi. */
export function getSnapshot(): string | null {
  if (!loaded) {
    cached = readStorage();
    loaded = true;
  }
  return cached;
}

/** Serverda saqlangan holat yo'q — birinchi render har doim bo'sh. */
export function getServerSnapshot(): string | null {
  return null;
}

export function writeState(state: TestState | null): void {
  const serialized = state ? JSON.stringify(state) : null;
  try {
    if (serialized === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Yozib bo'lmadi — seans xotirada davom etadi.
  }
  cached = serialized;
  loaded = true;
  emit();
}

/** Hydration tugaganini bilish uchun — serverda `false`, klientda `true`. */
const noopSubscribe = () => () => {};
export const hydrationStore = {
  subscribe: noopSubscribe,
  getSnapshot: () => true,
  getServerSnapshot: () => false,
};
