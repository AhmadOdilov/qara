/**
 * Demo ma'lumotlari: bitta admin, bir nechta foydalanuvchi, bog'langan
 * Telegram hisoblari, oxirgi 30 kunlik xabarlar tarixi va analitika hodisalari.
 *
 * Ishga tushirish:  npm run db:seed
 */
import { PrismaClient, type Lang } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "qara1234";

const PEOPLE: { name: string; email: string; lang: Lang; admin?: boolean }[] = [
  { name: "Akhmadbek Odilov", email: "admin@qara.uz", lang: "uz", admin: true },
  { name: "Dilnoza Karimova", email: "dilnoza@example.com", lang: "uz" },
  { name: "Ivan Petrov", email: "ivan@example.com", lang: "ru" },
  { name: "Sarah Klein", email: "sarah@example.com", lang: "en" },
  { name: "Javohir Tursunov", email: "javohir@example.com", lang: "uz" },
];

const OUTGOING = [
  "Salom! Buyurtmam holati qanday?",
  "Yetkazib berish qachon bo'ladi?",
  "Rahmat, hammasi joyida 👍",
  "Hisob-fakturani yuborsangiz bo'ladimi?",
  "Ertaga qo'ng'iroq qilsam bo'ladimi?",
  "Narxlar ro'yxatini ko'rmoqchi edim",
];

const INCOMING = [
  "Salom! Buyurtmangiz yo'lda, ertaga yetkaziladi.",
  "Albatta, hozir yuboraman.",
  "Rahmat, murojaatingiz uchun!",
  "Kuryer bugun soat 15:00 da yetib boradi.",
  "Ha, ertaga 10:00 dan 18:00 gacha bandmiz emas.",
  "Narxlar ro'yxati saytimizda mavjud.",
];

async function main() {
  console.log("Demo ma'lumotlari tayyorlanmoqda…");

  // Takroriy seed'da eski demo yozuvlari qaytadan yaratilmasin.
  await prisma.user.deleteMany({
    where: { email: { in: PEOPLE.map((person) => person.email) } },
  });

  await prisma.botSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      welcomeMessage: "Salom! Hisobingiz Qara'ga muvaffaqiyatli bog'landi.",
      rateLimitPerMin: 20,
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = Date.now();

  for (const [index, person] of PEOPLE.entries()) {
    const createdAt = new Date(now - (40 - index * 5) * 864e5);

    const user = await prisma.user.create({
      data: {
        name: person.name,
        email: person.email,
        passwordHash,
        lang: person.lang,
        role: person.admin ? "admin" : "user",
        quietHours: index % 3 === 0,
        createdAt,
      },
    });

    // Oxirgi foydalanuvchini ataylab bog'lanmagan qoldiramiz — admin
    // panelida ikkala holat ham ko'rinsin.
    const linked = index < PEOPLE.length - 1;
    const chatId = String(800_000_000 + index * 7919);

    await prisma.telegramLink.create({
      data: {
        userId: user.id,
        linkToken: linked ? `used_${randomBytes(8).toString("hex")}` : randomBytes(18).toString("base64url"),
        linkTokenExp: new Date(now + 15 * 60_000),
        ...(linked
          ? {
              telegramChatId: chatId,
              telegramUserId: chatId,
              username: person.email.split("@")[0],
              firstName: person.name.split(" ")[0],
              languageCode: person.lang,
              connectedAt: new Date(createdAt.getTime() + 3600_000),
            }
          : {}),
      },
    });

    if (!linked) continue;

    // Oxirgi 30 kun uchun tabiiy ko'rinadigan yozishmalar.
    const messages: {
      userId: string;
      telegramUserId: string;
      direction: "outgoing" | "incoming";
      fromUser: boolean;
      content: string;
      kind: string;
      status: "sent";
      timestamp: Date;
    }[] = [];

    for (let day = 29; day >= 0; day--) {
      // Hafta oxirida faollik pastroq — grafik jonli ko'rinsin.
      const date = new Date(now - day * 864e5);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const base = weekend ? 0 : 1;
      const count = base + Math.floor(pseudoRandom(index, day) * (weekend ? 2 : 4));

      for (let n = 0; n < count; n++) {
        const at = new Date(date);
        at.setHours(9 + ((n * 3) % 9), (n * 17) % 60, 0, 0);

        messages.push({
          userId: user.id,
          telegramUserId: chatId,
          direction: "outgoing",
          fromUser: true,
          content: OUTGOING[(index + day + n) % OUTGOING.length],
          kind: "text",
          status: "sent",
          timestamp: at,
        });

        // Javoblar soni 0–2 orasida o'zgaradi: har xabarga aniq bitta javob
        // bo'lsa, grafikdagi ikki chiziq ustma-ust tushib, biri ko'rinmay
        // qoladi. Bu yerda nisbat tabiiyroq.
        const replies = Math.floor(pseudoRandom(day, index + n) * 2.4);
        for (let r = 0; r < replies; r++) {
          messages.push({
            userId: user.id,
            telegramUserId: chatId,
            direction: "incoming",
            fromUser: false,
            content: INCOMING[(index + day + n + r) % INCOMING.length],
            kind: "text",
            status: "sent",
            timestamp: new Date(at.getTime() + (4 + r * 3) * 60_000),
          });
        }
      }
    }

    await prisma.message.createMany({ data: messages });

    await prisma.analyticsEvent.createMany({
      data: [
        { userId: user.id, event: "signup", recordedAt: createdAt },
        {
          userId: user.id,
          event: "telegram_linked",
          recordedAt: new Date(createdAt.getTime() + 3600_000),
        },
        {
          userId: user.id,
          event: "message_sent",
          value: messages.filter((m) => m.direction === "outgoing").length,
          recordedAt: new Date(),
        },
      ],
    });

    console.log(
      `  ${person.name} — ${messages.length} xabar${person.admin ? " (admin)" : ""}`,
    );
  }

  console.log("\nTayyor. Kirish uchun:");
  console.log(`  admin:  admin@qara.uz / ${DEMO_PASSWORD}`);
  console.log(`  user:   dilnoza@example.com / ${DEMO_PASSWORD}`);
}

/** Har safar bir xil natija beradigan oddiy determinlashgan «tasodif». */
function pseudoRandom(a: number, b: number): number {
  const x = Math.sin((a + 1) * 12.9898 + (b + 1) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
