import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFilters, priceLabel, priceParam, priceRanges } from "./catalog-shared";

// Run with: pnpm test

describe("shop filters", () => {
  it("picks price ranges that suit the products shown", () => {
    // Cheap jewellery: ranges in tens.
    assert.deepEqual(
      priceRanges([12.95, 16.95, 19.95, 24.95, 34.95]).map(priceLabel),
      ["Under $20", "$20 – $30", "$30+"],
    );
    // Watches: ranges in hundreds, no empty ones.
    assert.deepEqual(priceRanges([89.95, 129.95, 149.95]).map(priceLabel), ["Under $100", "$100+"]);
    // Counts add up to the number of products.
    const ranges = priceRanges([5, 15, 25, 60, 120, 250, 900]);
    assert.ok(ranges.length <= 5);
    assert.equal(ranges.reduce((n, r) => n + r.count, 0), 7);
    assert.deepEqual(priceRanges([]), []);
  });

  it("reads filters from the URL", () => {
    const f = parseFilters({ price: "20-50", colour: ["Navy", "Black"], size: "M", sort: "price-asc", page: "2", variant: "abc" });
    assert.deepEqual(f.price, { min: 20, max: 50 });
    assert.deepEqual(f.attrs, { colour: ["Navy", "Black"], size: ["M"] }, "variant isn't a filter");
    assert.equal(f.sort, "price-asc");
    assert.equal(f.page, 2);
    assert.deepEqual(parseFilters({ price: "200-" }).price, { min: 200, max: null });
    assert.equal(parseFilters({ price: "50-20" }).price, null, "max must be above min");
    assert.equal(parseFilters({ price: "under-20" }).price, null);
    assert.equal(priceParam({ min: 200, max: null }), "200-");
  });
});
