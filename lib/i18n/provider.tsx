"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary, Lang } from "@/lib/i18n/dictionaries";

type I18nValue = { lang: Lang; t: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Lug'at serverda tanlanadi va bir marta klientga uzatiladi — shunda
 * klient komponentlar uch tilning hammasini bundle'ga tortmaydi.
 */
export function I18nProvider({
  value,
  children,
}: {
  value: I18nValue;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n I18nProvider ichida ishlatilishi kerak");
  return value;
}
