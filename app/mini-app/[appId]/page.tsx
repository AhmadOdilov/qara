import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublishedApp } from "@/lib/mini-app/service";
import { MiniAppRuntime } from "@/components/mini-app/runtime";

/**
 * Telegram ochadigan Mini App sahifasi.
 *
 * Bu yo'l OCHIQ: dashboard sessiyasi talab qilinmaydi, chunki uni Telegram
 * foydalanuvchisi ochadi. Himoya boshqa qatlamda:
 *
 *  · faqat NASHR ETILGAN ilova ko'rinadi (`loadPublishedApp`) — qoralama va
 *    nashrdan olingan ilova «topilmadi» beradi;
 *  · foydalanuvchini tanish `initData` imzosi bilan, serverda bo'ladi;
 *  · `proxy.ts` shu yo'lga Telegram uchun alohida CSP qo'yadi (dashboard
 *    hamon `frame-ancestors 'none'` bilan qulflangan).
 *
 * Sahifa dinamik: nashr o'zgarganda darhol yangi surat ko'rinishi kerak.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ appId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { appId } = await params;
  const published = await loadPublishedApp(appId);
  return {
    title: published?.schema.name ?? "Mini App",
    // Mini App Telegram ichida yashaydi — qidiruvda chiqishi shart emas.
    robots: { index: false, follow: false },
  };
}

export default async function MiniAppPage({ params }: Params) {
  const { appId } = await params;

  const published = await loadPublishedApp(appId);
  if (!published) notFound();

  return (
    <>
      {/* Telegram Web App SDK. `proxy.ts` shu manbaga ataylab ruxsat beradi. */}
      <script src="https://telegram.org/js/telegram-web-app.js" async />
      <MiniAppRuntime schema={published.schema} />
    </>
  );
}
