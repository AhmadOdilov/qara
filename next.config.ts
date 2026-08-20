import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Docker uchun `standalone`: Next butun `node_modules` o'rniga faqat
   * ishlash uchun kerak bo'lgan fayllarni `.next/standalone` ga yig'adi.
   * Natijada runtime image bir necha yuz MB emas, ~150-200 MB bo'ladi.
   *
   * Lokal `npm run dev` va `npm run start` ga ta'sir qilmaydi.
   */
  output: "standalone",

  /**
   * Docker build kontekstida loyiha ildizini aniq ko'rsatamiz — aks holda
   * Next monorepo deb o'ylab `standalone` ni noto'g'ri joyga yig'ishi mumkin.
   */
  outputFileTracingRoot: import.meta.dirname,

  /**
   * `X-Powered-By: Next.js` sarlavhasini o'chiradi. U hech qanday foyda
   * bermaydi, lekin hujumchiga qaysi freymvork ishlatilayotganini aytadi —
   * ya'ni qaysi CVE ro'yxatidan boshlashni.
   */
  poweredByHeader: false,
};

export default nextConfig;
