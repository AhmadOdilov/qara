/**
 * SSRF himoyasi.
 *
 * Bu testlar «ishlaydimi» degan savolga emas, «TESHIK bormi» degan savolga
 * javob beradi. Shuning uchun ro'yxat ataylab uzun: har bir ma'lum ichki
 * diapazon va bulut metadata manzili alohida tekshiriladi.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { assertSafeUrl, isPublicIp, SsrfError } from "../../lib/mini-app/ssrf";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof SsrfError, `SsrfError kutilgan edi, keldi: ${error}`);
    return error.code;
  }
  throw new Error("xato kutilgan edi, lekin o'tib ketdi");
}

/* ── IP diapazonlari ─────────────────────────────────────────────────────── */

describe("ichki IPv4 manzillari yopiq", () => {
  const blocked = [
    ["0.0.0.0", "belgilanmagan"],
    ["10.0.0.1", "xususiy 10/8"],
    ["10.255.255.255", "xususiy 10/8 chegara"],
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback chegara"],
    ["169.254.169.254", "AWS/GCP/Azure metadata"],
    ["169.254.0.1", "link-local"],
    ["172.16.0.1", "xususiy 172.16/12"],
    ["172.31.255.255", "xususiy 172.16/12 chegara"],
    ["192.168.1.1", "xususiy 192.168/16"],
    ["100.100.100.200", "Alibaba metadata (CGNAT)"],
    ["100.64.0.1", "CGNAT"],
    ["192.0.0.1", "IETF protokol"],
    ["192.0.2.1", "TEST-NET-1"],
    ["198.18.0.1", "benchmark"],
    ["198.51.100.1", "TEST-NET-2"],
    ["203.0.113.1", "TEST-NET-3"],
    ["224.0.0.1", "multicast"],
    ["240.0.0.1", "rezerv"],
    ["255.255.255.255", "broadcast"],
  ] as const;

  for (const [ip, why] of blocked) {
    test(`${ip} — ${why}`, () => {
      assert.equal(isPublicIp(ip), false);
    });
  }
});

describe("ochiq IPv4 manzillari o'tadi", () => {
  for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.32.0.1", "11.0.0.1"]) {
    test(ip, () => assert.equal(isPublicIp(ip), true));
  }
});

describe("IPv6", () => {
  const blocked = [
    ["::1", "loopback"],
    ["::", "belgilanmagan"],
    ["fc00::1", "unique local"],
    ["fd00:ec2::254", "AWS IPv6 metadata"],
    ["fe80::1", "link-local"],
    ["ff02::1", "multicast"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
    // `URL` aynan shu HEX shaklga normallashtiradi — naqsh bo'yicha
    // tekshiruv buni o'tkazib yuborardi.
    ["::ffff:7f00:1", "IPv4-mapped loopback (hex)"],
    ["::ffff:a9fe:a9fe", "IPv4-mapped metadata (hex)"],
    ["::ffff:169.254.169.254", "IPv4-mapped metadata"],
    ["::127.0.0.1", "IPv4-compatible loopback"],
    ["64:ff9b::7f00:1", "NAT64"],
    ["2001:db8::1", "hujjat"],
  ] as const;

  for (const [ip, why] of blocked) {
    test(`${ip} yopiq — ${why}`, () => assert.equal(isPublicIp(ip), false));
  }

  test("ochiq IPv6 o'tadi", () => {
    assert.equal(isPublicIp("2606:4700:4700::1111"), true);
  });
});

/* ── URL tuzilishi ───────────────────────────────────────────────────────── */

describe("URL tekshiruvi", () => {
  test("oddiy HTTPS manzil o'tadi", () => {
    assert.equal(assertSafeUrl("https://api.example.com/v1/products").hostname, "api.example.com");
  });

  test("HTTP rad etiladi", () => {
    assert.equal(codeOf(() => assertSafeUrl("http://api.example.com")), "protocol");
  });

  test("file va gopher rad etiladi", () => {
    assert.equal(codeOf(() => assertSafeUrl("file:///etc/passwd")), "protocol");
    assert.equal(codeOf(() => assertSafeUrl("gopher://example.com")), "protocol");
  });

  test("localhost rad etiladi", () => {
    assert.equal(codeOf(() => assertSafeUrl("https://localhost/admin")), "hostname");
  });

  test("ichki zona domenlari rad etiladi", () => {
    assert.equal(codeOf(() => assertSafeUrl("https://db.internal/x")), "hostname");
    assert.equal(codeOf(() => assertSafeUrl("https://printer.local/x")), "hostname");
  });

  test("metadata hostnamelari rad etiladi", () => {
    assert.equal(
      codeOf(() => assertSafeUrl("https://metadata.google.internal/computeMetadata/v1/")),
      "hostname",
    );
  });

  test("to'g'ridan-to'g'ri ichki IP rad etiladi", () => {
    // Bu manzil hostname ro'yxatida ham turibdi — DNS'gacha kesiladi.
    assert.ok(
      ["hostname", "private_ip"].includes(
        codeOf(() => assertSafeUrl("https://169.254.169.254/latest/meta-data/")),
      ),
    );
    assert.equal(codeOf(() => assertSafeUrl("https://127.0.0.1/")), "private_ip");
    assert.equal(codeOf(() => assertSafeUrl("https://[::1]/")), "private_ip");
    assert.equal(codeOf(() => assertSafeUrl("https://[fd00::1]/")), "private_ip");
    assert.equal(codeOf(() => assertSafeUrl("https://[::ffff:127.0.0.1]/")), "private_ip");
  });

  test("standart bo'lmagan port rad etiladi", () => {
    assert.equal(codeOf(() => assertSafeUrl("https://example.com:6379/")), "port");
    assert.equal(codeOf(() => assertSafeUrl("https://example.com:22/")), "port");
  });

  test("login/parolli manzil rad etiladi", () => {
    assert.equal(codeOf(() => assertSafeUrl("https://user:pass@example.com/")), "hostname");
  });

  test("nuqta bilan tugagan host ham normallashadi", () => {
    assert.equal(codeOf(() => assertSafeUrl("https://localhost./")), "hostname");
  });

  /* Allowlist */

  test("allowlist tashqarisidagi domen rad etiladi", () => {
    assert.equal(
      codeOf(() => assertSafeUrl("https://evil.com/x", ["example.com"])),
      "not_allowed",
    );
  });

  test("allowlistdagi domen va uning subdomeni o'tadi", () => {
    assert.doesNotThrow(() => assertSafeUrl("https://example.com/x", ["example.com"]));
    assert.doesNotThrow(() => assertSafeUrl("https://api.example.com/x", ["example.com"]));
  });

  test("o'xshash nomli domen allowlistni chetlab o'tolmaydi", () => {
    // `notexample.com` — `example.com` bilan tugaydi, lekin boshqa domen.
    assert.equal(
      codeOf(() => assertSafeUrl("https://notexample.com/x", ["example.com"])),
      "not_allowed",
    );
  });
});
