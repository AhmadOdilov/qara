/**
 * Forma validatsiyasi — SOF va UMUMIY.
 *
 * Aynan shu funksiya ikki joyda ishlaydi: Mini App'da (foydalanuvchi darhol
 * xatoni ko'radi) va serverda (klientga ishonib bo'lmaydi). Bitta qoida ikki
 * joyda yozilsa, ular albatta bir-biridan ajralib ketardi.
 *
 * `server-only` EMAS: runtime klientda ishlaydi.
 */

import { flattenComponents, type MiniAppComponent } from "@/lib/mini-app/schema";

export type FieldError = { name: string; label: string; message: string };

/**
 * Email uchun ataylab sodda qoida.
 *
 * To'liq RFC 5322 naqshi amalda foyda bermaydi — u haqiqiy manzillarni ham
 * rad etadi. Bu yerdagi maqsad: aniq xato terishni ushlash, qolganini
 * pochta xizmati o'zi hal qiladi.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateForm(
  components: MiniAppComponent[],
  values: Record<string, string>,
): FieldError[] {
  const errors: FieldError[] = [];

  for (const node of flattenComponents(components)) {
    if (node.type !== "input") continue;

    const { name, label, required, type, minLength, maxLength, pattern } = node.props;
    const shown = label?.trim() || name;
    const raw = values[name] ?? "";
    const value = raw.trim();

    if (!value) {
      if (required) {
        errors.push({ name, label: shown, message: `«${shown}» to'ldirilishi shart` });
      }
      // Bo'sh va majburiy bo'lmagan maydonga qolgan qoidalar tegmaydi.
      continue;
    }

    if (minLength !== undefined && value.length < minLength) {
      errors.push({
        name,
        label: shown,
        message: `«${shown}» kamida ${minLength} belgidan iborat bo'lsin`,
      });
      continue;
    }

    if (maxLength !== undefined && value.length > maxLength) {
      errors.push({
        name,
        label: shown,
        message: `«${shown}» ${maxLength} belgidan oshmasin`,
      });
      continue;
    }

    if (type === "email" && !EMAIL.test(value)) {
      errors.push({ name, label: shown, message: `«${shown}» email manzil emas` });
      continue;
    }

    if (type === "number" && !Number.isFinite(Number(value))) {
      errors.push({ name, label: shown, message: `«${shown}» raqam bo'lishi kerak` });
      continue;
    }

    if (type === "tel" && !/^[+\d][\d\s()-]{5,}$/.test(value)) {
      errors.push({ name, label: shown, message: `«${shown}» telefon raqamiga o'xshamaydi` });
      continue;
    }

    if (pattern) {
      const regex = safeRegex(pattern);
      // Naqsh buzuq bo'lsa maydonni rad etmaymiz: bu egasining xatosi,
      // foydalanuvchini jazolash noto'g'ri bo'lardi.
      if (regex && !regex.test(value)) {
        errors.push({ name, label: shown, message: `«${shown}» talab qilingan shaklda emas` });
      }
    }
  }

  return errors;
}

/**
 * Naqshni xavfsiz o'girish.
 *
 * Egasi yozgan naqsh buzuq bo'lishi mumkin — bunda `null` qaytadi va qoida
 * o'tkazib yuboriladi. Uzunlik ham cheklangan: juda murakkab naqsh
 * (katastrofik backtracking) brauzerni qotirib qo'ymasin.
 */
function safeRegex(pattern: string): RegExp | null {
  if (pattern.length > 200) return null;
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}
