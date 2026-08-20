"use client";

/**
 * `window.Telegram.WebApp` ustidan yupqa, tiplangan qatlam.
 *
 * Nega kerak:
 *  · SDK skript sifatida yuklanadi va `window` da paydo bo'ladi — komponentlar
 *    har joyda `any` bilan ishlamasligi uchun bitta joyda tip beriladi.
 *  · SDK BO'LMAGAN holat normal hisoblanadi: Mini App'ni oddiy brauzerda ham
 *    ochish mumkin (konstruktordagi preview, ishlab chiqish). Shunda hamma
 *    funksiya jimgina bo'sh ishlaydi va sahifa baribir chiziladi.
 *
 * MUHIM: `initDataUnsafe` bu yerda ATAYLAB berilmaydi. Foydalanuvchini tanish
 * faqat serverda, `initData` imzosini tekshirish orqali bo'ladi
 * (`lib/mini-app/auth.ts`). Klientdagi qiymatga ishonish autentifikatsiyani
 * butunlay bekor qilardi.
 */

export type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  section_separator_color?: string;
};

type MainButton = {
  setText(text: string): MainButton;
  show(): MainButton;
  hide(): MainButton;
  enable(): MainButton;
  disable(): MainButton;
  onClick(handler: () => void): MainButton;
  offClick(handler: () => void): MainButton;
};

type BackButton = {
  show(): BackButton;
  hide(): BackButton;
  onClick(handler: () => void): BackButton;
  offClick(handler: () => void): BackButton;
};

export type TelegramWebApp = {
  initData: string;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  viewportStableHeight?: number;
  isExpanded?: boolean;
  ready(): void;
  expand(): void;
  close(): void;
  sendData(data: string): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  showAlert(message: string, callback?: () => void): void;
  MainButton: MainButton;
  BackButton: BackButton;
  onEvent(event: string, handler: () => void): void;
  offEvent(event: string, handler: () => void): void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** SDK hozir mavjudmi. Brauzerda ochilganda `null` qaytadi — bu xato emas. */
export function webApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * SDK yuklanishini kutadi.
 *
 * Skript `async` yuklangani uchun komponent undan oldin ishga tushishi mumkin.
 * Cheksiz kutmaymiz: berilgan vaqtdan keyin `null` qaytadi va ilova
 * «Telegramsiz» rejimda ochiladi.
 */
export function waitForWebApp(timeoutMs = 3000): Promise<TelegramWebApp | null> {
  const existing = webApp();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const sdk = webApp();
      if (sdk || Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve(sdk);
      }
    }, 50);
  });
}

/**
 * Telegram mavzusini CSS o'zgaruvchilariga ko'chiradi.
 *
 * Shu tufayli komponentlar `var(--tg-text)` kabi nomlar bilan ishlaydi va
 * light/dark almashganda o'zi to'g'rilanadi. Telegram bo'lmasa — mantiqiy
 * standart qiymatlar qo'yiladi, ilova baribir o'qiladigan bo'ladi.
 */
export function applyTheme(
  root: HTMLElement,
  params: TelegramThemeParams | undefined,
  scheme: "light" | "dark",
): void {
  const dark = scheme === "dark";
  const fallback = {
    bg: dark ? "#17212b" : "#ffffff",
    text: dark ? "#f5f5f5" : "#000000",
    hint: dark ? "#7d8b99" : "#707579",
    link: dark ? "#6ab3f3" : "#2481cc",
    button: dark ? "#5288c1" : "#2481cc",
    buttonText: "#ffffff",
    secondaryBg: dark ? "#232e3c" : "#f4f4f5",
    sectionBg: dark ? "#17212b" : "#ffffff",
    separator: dark ? "#2f3b47" : "#e5e5e7",
  };

  const set = (name: string, value: string | undefined, fall: string) => {
    root.style.setProperty(name, value?.trim() || fall);
  };

  set("--tg-bg", params?.bg_color, fallback.bg);
  set("--tg-text", params?.text_color, fallback.text);
  set("--tg-hint", params?.hint_color, fallback.hint);
  set("--tg-link", params?.link_color, fallback.link);
  set("--tg-button", params?.button_color, fallback.button);
  set("--tg-button-text", params?.button_text_color, fallback.buttonText);
  set("--tg-secondary-bg", params?.secondary_bg_color, fallback.secondaryBg);
  set("--tg-section-bg", params?.section_bg_color, fallback.sectionBg);
  set("--tg-section-separator", params?.section_separator_color, fallback.separator);
}
