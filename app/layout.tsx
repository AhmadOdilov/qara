import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Qara — veb va Telegram muloqoti",
    template: "%s · Qara",
  },
  description:
    "Veb-sahifadan to'g'ridan-to'g'ri Telegram botga xabar yuboring va javoblarni shu yerda oling. Google bilan kirish, analitika, admin panel, uch tilli interfeys.",
  applicationName: "Qara",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { lang, t } = await getDictionary();

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <I18nProvider value={{ lang, t }}>{children}</I18nProvider>
      </body>
    </html>
  );
}
