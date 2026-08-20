import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Xavfsizlik sarlavhalari (Next 16 `proxy` konvensiyasi — eski `middleware`
 * o'rniga). Autentifikatsiya bu yerda tekshirilmaydi — u sahifa
 * layout'larida (server tomonda, bazaga murojaat bilan) amalga oshiriladi,
 * chunki bu qatlam Edge muhitida ishlaydi va Prisma'ga kira olmaydi.
 *
 * IKKI XIL SIYOSAT bor:
 *
 *   1. Dashboard va API — to'liq qulflangan: sahifani hech kim iframe'ga
 *      sola olmaydi (`frame-ancestors 'none'` + `X-Frame-Options: DENY`).
 *
 *   2. `/mini-app/*` — Telegram Mini App. Telegram Desktop va Web uni AYNAN
 *      iframe ichida ochadi va `telegram.org` dagi SDK'ni yuklaydi, shuning
 *      uchun bu yo'lda `DENY` qo'yib bo'lmaydi — aks holda Mini App umuman
 *      ochilmaydi. Ruxsat yopiq ro'yxat bilan beriladi: faqat Telegram
 *      manbalari va faqat shu yo'l uchun.
 */

/** Mini App'ni iframe'ga sola oladigan manbalar. */
const TELEGRAM_FRAME_ANCESTORS = [
  "https://web.telegram.org",
  "https://*.telegram.org",
  "https://*.telegram.dog",
];

/** Telegram Web App SDK shu manzildan yuklanadi. */
const TELEGRAM_SDK_ORIGIN = "https://telegram.org";

export default function proxy(request: NextRequest) {
  const isMiniApp = request.nextUrl.pathname.startsWith("/mini-app");
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  // Mini App Telegram iframe'ida yashaydi — bu sarlavha uni bloklardi.
  if (!isMiniApp) {
    response.headers.set("X-Frame-Options", "DENY");
  }

  // Produksiyada HTTPS majburiy (PDF: «Butun tizimda HTTPS/SSL talab qilinadi»)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  response.headers.set(
    "Content-Security-Policy",
    (isMiniApp ? miniAppCsp() : dashboardCsp()).join("; "),
  );

  return response;
}

/** Dashboard: hech qanday tashqi skript ham, iframe ham yo'q. */
function dashboardCsp(): string[] {
  // Next.js dev rejimi HMR uchun 'unsafe-eval' talab qiladi.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? "'self' 'unsafe-inline'"
      : "'self' 'unsafe-inline' 'unsafe-eval'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    // Telegram avatar/rasmlari uchun img-src'da https ochiq qoldirilgan.
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
}

/**
 * Mini App: Telegram SDK'siga va Telegram iframe'iga ruxsat, boshqasiga yo'q.
 *
 * `connect-src 'self'` ataylab tor qoldirilgan: Mini App tashqi API'ga
 * to'g'ridan-to'g'ri chiqmaydi, hamma so'rov bizning server orqali o'tadi —
 * shunda kalitlar klientga tushmaydi va manzil server tomonda tekshiriladi.
 */
function miniAppCsp(): string[] {
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `'self' 'unsafe-inline' ${TELEGRAM_SDK_ORIGIN}`
      : `'self' 'unsafe-inline' 'unsafe-eval' ${TELEGRAM_SDK_ORIGIN}`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    `frame-ancestors ${TELEGRAM_FRAME_ANCESTORS.join(" ")}`,
    "base-uri 'self'",
    "form-action 'self'",
  ];
}

export const config = {
  matcher: [
    // Statik fayllar va rasm optimizatsiyasidan tashqari hamma yo'l
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
