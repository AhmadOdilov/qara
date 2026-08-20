import type { Metadata } from "next";

export const metadata: Metadata = { title: "Foydalanish shartlari" };

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Foydalanish shartlari
      </h1>

      <h2>1. Xizmat haqida</h2>
      <p>
        Qara — veb-interfeys orqali Telegram bot bilan ikki tomonlama xabar
        almashish imkonini beruvchi platforma. Xizmatdan foydalanish orqali siz
        ushbu shartlarga rozilik bildirasiz.
      </p>

      <h2>2. Hisob</h2>
      <ul>
        <li>Bitta shaxs uchun bitta hisob. Ma&apos;lumotlar haqiqiy bo&apos;lishi kerak.</li>
        <li>Parol va hisob xavfsizligi uchun javobgarlik foydalanuvchida.</li>
        <li>Ruxsatsiz kirish aniqlansa, darhol xabar bering.</li>
      </ul>

      <h2>3. Ruxsat etilmagan foydalanish</h2>
      <ul>
        <li>Spam, ommaviy tarqatma yoki avtomatlashtirilgan suiiste&apos;mol</li>
        <li>Qonunga zid, haqoratli yoki boshqalarning huquqini buzuvchi kontent</li>
        <li>Tizimga zarar yetkazish, rate limitlarni chetlab o&apos;tishga urinish</li>
        <li>Telegram Bot API shartlarini buzadigan har qanday harakat</li>
      </ul>
      <p>
        Bunday holatlarda hisob ogohlantirishsiz cheklanishi yoki
        o&apos;chirilishi mumkin.
      </p>

      <h2>4. Telegram bilan bog&apos;liqlik</h2>
      <p>
        Xizmat Telegram Bot API&apos;siga tayanadi. Telegram tomonidagi
        uzilishlar, limitlar yoki siyosat o&apos;zgarishlari xizmat ishiga
        ta&apos;sir qilishi mumkin. Qara Telegram Messenger LLP bilan rasmiy
        aloqada emas.
      </p>

      <h2>5. Xizmat kafolati</h2>
      <p>
        Xizmat &laquo;bor holicha&raquo; taqdim etiladi. Uzluksiz ishlash yoki
        xatosizlik kafolatlanmaydi. Ma&apos;lumotlaringizning zaxira nusxasini
        <strong> Profil → Ma&apos;lumotlarimni eksport qilish</strong> orqali
        olishingiz mumkin.
      </p>

      <h2>6. O&apos;zgarishlar</h2>
      <p>
        Shartlar yangilanishi mumkin. Muhim o&apos;zgarishlar haqida elektron
        pochta yoki ilova ichida xabar beriladi.
      </p>

      <h2>7. Aloqa</h2>
      <p>
        <a href="mailto:hello@qara.uz" className="text-accent hover:underline">
          hello@qara.uz
        </a>
      </p>
    </>
  );
}
