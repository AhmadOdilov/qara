/**
 * API kalitlari uchdan-uchgacha — HAQIQIY baza bilan (§8).
 *
 * `npm test` dagi sof testlar formatni tekshiradi; bu fayl esa service
 * qatlami, Prisma va ijarachilik cheklovi BIRGALIKDA to'g'ri ishlashini
 * tekshiradi. `npm run test:e2e` bilan yuritiladi va `DATABASE_URL` talab
 * qiladi.
 *
 * Tekshiriladigan oqim:
 *   yaratish → ochiq matn faqat bir marta → ro'yxatda maska → nomini
 *   o'zgartirish → tekshirish → bekor qilish → o'chirish
 *
 * Xavfsizlik tomoni: bazada ochiq matn yo'qligi, bekor qilingan kalitning
 * ishlamasligi va BEGONA ish maydoni kalitga tega olmasligi.
 */

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import {
  ApiKeyError,
  createApiKey,
  deleteApiKey,
  hashApiKey,
  listApiKeys,
  renameApiKey,
  revokeApiKey,
  verifyApiKey,
} from "../../lib/api-keys";

const prisma = new PrismaClient();
const TAG = randomUUID().slice(0, 8);

let userId = "";
let workspaceId = "";
/** Begona ijarachi — izolyatsiyani tekshirish uchun. */
let foreignWorkspaceId = "";

let keyId = "";
let plainKey = "";

before(async () => {
  const user = await prisma.user.create({
    data: { name: "E2E kalit", email: `e2e-key-${TAG}@example.test`, lang: "uz" },
  });
  userId = user.id;

  const workspace = await prisma.workspace.create({
    data: { id: `ws_key_${TAG}`, name: "E2E kalit", slug: `w-key-${TAG}` },
  });
  workspaceId = workspace.id;
  await prisma.workspaceMember.create({
    data: { workspaceId, userId, role: "owner" },
  });

  const foreign = await prisma.workspace.create({
    data: { id: `ws_key_begona_${TAG}`, name: "Begona", slug: `w-key-b-${TAG}` },
  });
  foreignWorkspaceId = foreign.id;
});

after(async () => {
  await prisma.apiKey.deleteMany({ where: { workspaceId } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({
    where: { id: { in: [workspaceId, foreignWorkspaceId] } },
  });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("API kalitlari — to'liq oqim", () => {
  test("1. yaratiladi va ochiq matn bir marta qaytadi", async () => {
    const result = await createApiKey({
      workspaceId,
      actorId: userId,
      name: "Ishlab chiqarish",
    });

    keyId = result.key.id;
    plainKey = result.plain;

    assert.match(plainKey, /^qara_sk_[A-Za-z0-9_-]{32,}$/);
    assert.equal(result.key.name, "Ishlab chiqarish");
    assert.equal(result.key.revokedAt, null);
    assert.equal(result.key.lastUsedAt, null);
    assert.equal(result.key.createdByName, "E2E kalit");
  });

  test("2. bazada OCHIQ MATN yo'q — faqat xesh", async () => {
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: keyId } });

    assert.equal(row.keyHash, hashApiKey(plainKey));
    assert.notEqual(row.keyHash, plainKey);

    // Butun yozuvni matnga aylantirib qidiramiz: hech bir ustunda kalitning
    // o'zi (yoki uning tasodifiy qismi) qolmasligi kerak.
    const dump = JSON.stringify(row);
    assert.ok(!dump.includes(plainKey), "yozuvda to'liq kalit topildi");
    const random = plainKey.slice("qara_sk_".length);
    assert.ok(!dump.includes(random), "yozuvda kalitning tasodifiy qismi topildi");
  });

  test("3. ro'yxatda faqat maska ko'rinadi", async () => {
    const keys = await listApiKeys(workspaceId);
    assert.equal(keys.length, 1);

    const [key] = keys;
    assert.equal(key.masked, `qara_sk_${"•".repeat(6)}${plainKey.slice(-4)}`);
    assert.ok(!JSON.stringify(key).includes(plainKey));
  });

  test("4. kalit tekshiruvdan o'tadi va ish maydonini beradi", async () => {
    const verified = await verifyApiKey(plainKey);
    assert.deepEqual(verified, { workspaceId, keyId });
  });

  test("5. yaroqsiz qiymat bazagacha yetib bormaydi", async () => {
    assert.equal(await verifyApiKey(""), null);
    assert.equal(await verifyApiKey("qara_sk_qisqa"), null);
    assert.equal(await verifyApiKey("boshqa_prefiks_" + "a".repeat(40)), null);
    // To'g'ri shakl, lekin mavjud emas
    assert.equal(await verifyApiKey(`qara_sk_${"a".repeat(40)}`), null);
  });

  test("6. nomini o'zgartirish kalitning o'zini o'zgartirmaydi", async () => {
    const renamed = await renameApiKey(keyId, workspaceId, "Sinov serveri");
    assert.equal(renamed.name, "Sinov serveri");

    // Kalit hamon ishlaydi
    assert.deepEqual(await verifyApiKey(plainKey), { workspaceId, keyId });
  });

  test("7. BEGONA ish maydoni kalitga tega olmaydi", async () => {
    for (const [nima, amal] of [
      ["nomini o'zgartirish", () => renameApiKey(keyId, foreignWorkspaceId, "Bosib olindi")],
      ["bekor qilish", () => revokeApiKey(keyId, foreignWorkspaceId)],
      ["o'chirish", () => deleteApiKey(keyId, foreignWorkspaceId)],
    ] as const) {
      await assert.rejects(
        amal,
        (error: unknown) =>
          error instanceof ApiKeyError && error.status === 404,
        `begona workspace ${nima} amalini bajara oldi`,
      );
    }

    // Begona ro'yxatda ham ko'rinmaydi
    assert.deepEqual(await listApiKeys(foreignWorkspaceId), []);

    // Va kalit hamon buzilmagan
    assert.deepEqual(await verifyApiKey(plainKey), { workspaceId, keyId });
  });

  test("8. bekor qilingan kalit darhol ishlamaydi", async () => {
    const revoked = await revokeApiKey(keyId, workspaceId);
    assert.ok(revoked.revokedAt instanceof Date);

    assert.equal(await verifyApiKey(plainKey), null);
  });

  test("9. ikki marta bekor qilib bo'lmaydi", async () => {
    await assert.rejects(
      () => revokeApiKey(keyId, workspaceId),
      (error: unknown) => error instanceof ApiKeyError && error.status === 409,
    );
  });

  test("10. bekor qilingan yozuv ro'yxatda qoladi (audit uchun)", async () => {
    const keys = await listApiKeys(workspaceId);
    assert.equal(keys.length, 1);
    assert.ok(keys[0].revokedAt);
  });

  test("11. o'chirilgach ro'yxat bo'shaydi", async () => {
    await deleteApiKey(keyId, workspaceId);
    assert.deepEqual(await listApiKeys(workspaceId), []);

    await assert.rejects(
      () => deleteApiKey(keyId, workspaceId),
      (error: unknown) => error instanceof ApiKeyError && error.status === 404,
    );
  });

  test("12. har bir kalit takrorlanmas", async () => {
    const a = await createApiKey({ workspaceId, actorId: userId, name: "A" });
    const b = await createApiKey({ workspaceId, actorId: userId, name: "B" });

    assert.notEqual(a.plain, b.plain);
    assert.notEqual(a.key.id, b.key.id);

    assert.deepEqual(await verifyApiKey(a.plain), {
      workspaceId,
      keyId: a.key.id,
    });
    assert.deepEqual(await verifyApiKey(b.plain), {
      workspaceId,
      keyId: b.key.id,
    });

    await prisma.apiKey.deleteMany({ where: { workspaceId } });
  });
});
