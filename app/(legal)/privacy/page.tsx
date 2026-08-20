import type { Metadata } from "next";

export const metadata: Metadata = { title: "Maxfiylik siyosati" };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Maxfiylik siyosati
      </h1>

      <h2>1. Qanday ma&apos;lumot to&apos;playmiz</h2>
      <ul>
        <li>
          <strong>Hisob ma&apos;lumotlari:</strong> ism, elektron pochta,
          parol hashi (bcrypt) yoki Google hisobingiz identifikatori.
        </li>
        <li>
          <strong>Telegram ma&apos;lumotlari:</strong> Telegram foydalanuvchi
          ID, chat ID, foydalanuvchi nomi va til kodi — botni hisobingizga
          bog&apos;lash uchun.
        </li>
        <li>
          <strong>Xabarlar:</strong> veb-ilova va Telegram o&apos;rtasida
          uzatilgan matn, yo&apos;nalish va vaqt belgisi.
        </li>
        <li>
          <strong>Texnik ma&apos;lumotlar:</strong> sessiya yozuvlari (IP,
          brauzer turi) va analitika hodisalari.
        </li>
      </ul>

      <h2>2. Nima uchun ishlatamiz</h2>
      <p>
        Ma&apos;lumotlar faqat xizmatni ko&apos;rsatish uchun ishlatiladi:
        xabarlarni yetkazish, hisobni himoya qilish, xizmat sifatini
        o&apos;lchash. Uchinchi tomonlarga sotilmaydi va reklama uchun
        berilmaydi.
      </p>

      <h2>3. Qayerda saqlanadi</h2>
      <p>
        Ma&apos;lumotlar PostgreSQL bazasida saqlanadi. Barcha aloqa HTTPS/SSL
        orqali shifrlanadi. Parollar bcrypt bilan hashlanadi va asl holida
        saqlanmaydi. Bot tokeni va OAuth kalitlari faqat server muhit
        o&apos;zgaruvchilarida turadi.
      </p>

      <h2>4. Sizning huquqlaringiz</h2>
      <ul>
        <li>Ma&apos;lumotlaringizni ko&apos;rish va JSON formatida eksport qilish</li>
        <li>Noto&apos;g&apos;ri ma&apos;lumotni tuzatish</li>
        <li>Hisobni va barcha bog&apos;liq yozuvlarni butunlay o&apos;chirish</li>
        <li>Telegram bog&apos;lanishini istalgan payt uzish</li>
      </ul>
      <p>
        Bu amallarning barchasi <strong>Profil</strong> bo&apos;limida
        mavjud — alohida so&apos;rov yuborish shart emas.
      </p>

      <h2>5. Saqlash muddati</h2>
      <p>
        Xabarlar va hisob ma&apos;lumotlari siz hisobni o&apos;chirmaguningizcha
        saqlanadi. Sessiya yozuvlari muddati tugagach avtomatik
        o&apos;chiriladi.
      </p>

      <h2>6. Huquqiy asos</h2>
      <p>
        Loyiha Yevropa Ittifoqining GDPR (Reg. 2016/679) va O&apos;zbekiston
        Respublikasining ZRU-547 &laquo;Shaxsiy ma&apos;lumotlar
        to&apos;g&apos;risida&raquo; qonuni talablarini hisobga olgan holda
        ishlab chiqilgan. O&apos;zbekistonda faoliyat yuritilganda shaxsiy
        ma&apos;lumotlar bazasini davlat reyestrida ro&apos;yxatdan
        o&apos;tkazish va ma&apos;lumotlarni mamlakat hududida saqlash talabi
        alohida ko&apos;rib chiqilishi lozim.
      </p>

      <h2>7. Aloqa</h2>
      <p>
        Savollar bo&apos;yicha:{" "}
        <a href="mailto:hello@qara.uz" className="text-accent hover:underline">
          hello@qara.uz
        </a>
      </p>
    </>
  );
}
