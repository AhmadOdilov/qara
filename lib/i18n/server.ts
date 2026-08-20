import "server-only";
import { cookies, headers } from "next/headers";
import {
  dictionaries,
  isLang,
  type Dictionary,
  type Lang,
} from "@/lib/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";

export const LANG_COOKIE = "qara_lang";

/**
 * Til tanlash tartibi:
 *   1) foydalanuvchi profilidagi til (kirgan bo'lsa),
 *   2) `qara_lang` cookie (mehmon tanlovi),
 *   3) Accept-Language sarlavhasi,
 *   4) uz.
 */
export async function resolveLang(): Promise<Lang> {
  const user = await getCurrentUser();
  if (user && isLang(user.lang)) return user.lang;

  const jar = await cookies();
  const fromCookie = jar.get(LANG_COOKIE)?.value;
  if (isLang(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const base = part.split(";")[0].trim().split("-")[0].toLowerCase();
    if (isLang(base)) return base;
  }
  return "uz";
}

export async function getDictionary(): Promise<{ lang: Lang; t: Dictionary }> {
  const lang = await resolveLang();
  return { lang, t: dictionaries[lang] };
}
