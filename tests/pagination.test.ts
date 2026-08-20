import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  pageCount,
  pageRange,
  readPage,
} from "@/lib/pagination";

describe("readPage", () => {
  it("parametrsiz standart qiymat beradi", () => {
    assert.deepEqual(readPage(undefined), {
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });

  it("to'g'ri qiymatlarni o'qiydi", () => {
    assert.deepEqual(readPage({ page: "3", size: "25" }), {
      page: 3,
      size: 25,
      skip: 50,
    });
  });

  it("buzuq qiymat standartga tushadi", () => {
    for (const bad of ["0", "-5", "abc", "", "1e9"]) {
      assert.equal(readPage({ page: bad }).page, 1, `page=${bad}`);
    }
  });

  it("size CHEGARADAN oshmaydi — og'ir so'rov yuborib bo'lmaydi", () => {
    assert.equal(readPage({ size: "5000" }).size, MAX_PAGE_SIZE);
    assert.equal(readPage({ size: "101" }).size, MAX_PAGE_SIZE);
    assert.equal(readPage({ size: "-1" }).size, DEFAULT_PAGE_SIZE);
  });

  it("page juda katta bo'lsa ham cheklanadi", () => {
    assert.equal(readPage({ page: "999999999" }).page, 10_000);
  });

  it("kasr son butunga tushadi", () => {
    assert.equal(readPage({ page: "2.9" }).page, 2);
  });
});

describe("pageCount", () => {
  it("bo'linmagan qoldiq uchun ham to'g'ri", () => {
    assert.equal(pageCount(0, 50), 1);
    assert.equal(pageCount(50, 50), 1);
    assert.equal(pageCount(51, 50), 2);
    assert.equal(pageCount(240, 50), 5);
  });
});

describe("pageRange", () => {
  it("diapazonni to'g'ri hisoblaydi", () => {
    assert.deepEqual(pageRange(1, 50, 240), { from: 1, to: 50 });
    assert.deepEqual(pageRange(2, 50, 240), { from: 51, to: 100 });
    assert.deepEqual(pageRange(5, 50, 240), { from: 201, to: 240 });
  });

  it("bo'sh jadvalda nol", () => {
    assert.deepEqual(pageRange(1, 50, 0), { from: 0, to: 0 });
  });
});
