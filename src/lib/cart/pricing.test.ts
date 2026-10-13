import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_QTY } from "@/lib/catalog-shared";
import { priceBag, tidyItems, type PricingDiscount, type PricingInput, type PricingProduct } from "./pricing";

// Run with: pnpm test

const NOW = new Date("2026-10-13T00:00:00Z");

function product(id: string, overrides: Partial<PricingProduct> = {}): PricingProduct {
  return {
    id,
    slug: id,
    name: id,
    live: true,
    categoryId: "earrings",
    price: 20,
    salePrice: null,
    stock: 50,
    image: null,
    variants: [],
    ...overrides,
  };
}

function discount(overrides: Partial<PricingDiscount>): PricingDiscount {
  return {
    id: overrides.code ?? "auto",
    code: null,
    type: "PERCENT",
    scope: "ALL",
    value: null,
    buyQuantity: null,
    getQuantity: null,
    minSpend: null,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    timesUsed: 0,
    perCustomerLimit: null,
    firstOrderOnly: false,
    active: true,
    categoryId: null,
    productIds: [],
    ...overrides,
  };
}

function bag(overrides: Partial<PricingInput>): PricingInput {
  return {
    items: [],
    code: null,
    products: [],
    discounts: [],
    shipping: { freeShippingThreshold: 50, flatShippingRate: 7.95 },
    customer: { orderCount: null, discountUses: {} },
    now: NOW,
    ...overrides,
  };
}

describe("priceBag", () => {
  it("uses sale prices, adds flat shipping under the free-shipping threshold", () => {
    const t = priceBag(
      bag({
        items: [
          { productId: "a", variantId: null, qty: 2 },
          { productId: "b", variantId: null, qty: 1 },
        ],
        products: [product("a", { price: 10.95 }), product("b", { price: 24.95, salePrice: 17.95 })],
      }),
    );
    assert.equal(t.subtotal, 39.85); // 2 × 10.95 + 17.95
    assert.equal(t.shipping, 7.95);
    assert.equal(t.total, 47.8);
    assert.equal(t.freeShippingRemaining, 10.15);
    assert.equal(t.savings, 7); // sale saving on b
    assert.equal(t.itemCount, 3);
    assert.equal(t.canCheckout, true);
  });

  it("gives free shipping once the threshold is reached", () => {
    const t = priceBag(
      bag({ items: [{ productId: "a", variantId: null, qty: 5 }], products: [product("a", { price: 10 })] }),
    );
    assert.equal(t.shipping, 0);
    assert.equal(t.freeShippingRemaining, 0);
    assert.equal(t.total, 50);
  });

  it("uses a finish's own price and stock", () => {
    const p = product("a", {
      price: 24.95,
      variants: [
        { id: "gold", name: "Gold", price: 29.95, salePrice: null, stock: 2, image: null },
        { id: "silver", name: "Silver", price: null, salePrice: null, stock: 0, image: null },
      ],
    });
    const t = priceBag(
      bag({
        items: [
          { productId: "a", variantId: "gold", qty: 3 },
          { productId: "a", variantId: "silver", qty: 1 },
        ],
        products: [p],
      }),
    );
    const [gold, silver] = t.lines;
    assert.equal(gold.unitPrice, 29.95);
    assert.equal(gold.qty, 2, "lowered to the 2 in stock");
    assert.equal(gold.issue, "reduced");
    assert.equal(silver.issue, "sold-out");
    assert.equal(t.subtotal, 59.9, "sold-out finish isn't charged");
    assert.equal(t.canCheckout, false, "sold-out item must be removed first");
  });

  it("drops deleted products and flags ones taken off sale", () => {
    const t = priceBag(
      bag({
        items: [
          { productId: "gone", variantId: null, qty: 1 },
          { productId: "draft", variantId: null, qty: 1 },
        ],
        products: [product("draft", { live: false })],
      }),
    );
    assert.equal(t.lines.length, 1);
    assert.equal(t.lines[0].issue, "unavailable");
    assert.equal(t.total, 0);
  });

  it("applies a percentage code and rejects unknown ones", () => {
    const products = [product("a", { price: 40 })];
    const items = [{ productId: "a", variantId: null, qty: 1 }];
    const discounts = [discount({ code: "WELCOME10", value: 10 })];

    const ok = priceBag(bag({ items, products, discounts, code: " welcome10 " }));
    assert.equal(ok.discount?.amount, 4);
    assert.equal(ok.code?.error, null);
    assert.equal(ok.total, 36 + 7.95);

    const bad = priceBag(bag({ items, products, discounts, code: "NOPE" }));
    assert.equal(bad.discount, null);
    assert.equal(bad.code?.recognised, false);
    assert.match(bad.code!.error!, /recognise/);
  });

  it("enforces minimum spend, expiry, usage limits and first-order-only", () => {
    const products = [product("a", { price: 20 })];
    const items = [{ productId: "a", variantId: null, qty: 1 }];
    const check = (d: Partial<PricingDiscount>, customer = { orderCount: null as number | null, discountUses: {} }) =>
      priceBag(bag({ items, products, discounts: [discount({ code: "X", value: 10, ...d })], code: "X", customer }))
        .code?.error;

    assert.match(check({ minSpend: 40 })!, /Spend \$40\.00/);
    assert.match(check({ endsAt: new Date("2026-01-01") })!, /expired/);
    assert.match(check({ usageLimit: 5, timesUsed: 5 })!, /fully redeemed/);
    assert.match(check({ firstOrderOnly: true }, { orderCount: 2, discountUses: {} })!, /first orders/);
    assert.equal(check({ firstOrderOnly: true }), null, "unknown guest may use it until checkout");
    assert.match(check({ perCustomerLimit: 1 }, { orderCount: 1, discountUses: { X: 1 } })!, /already used/);
  });

  it("buy 3 get 1 free makes the cheapest eligible item free, only in its category", () => {
    const t = priceBag(
      bag({
        items: [
          { productId: "a", variantId: null, qty: 2 },
          { productId: "b", variantId: null, qty: 1 },
          { productId: "c", variantId: null, qty: 1 },
          { productId: "ring", variantId: null, qty: 1 },
        ],
        products: [
          product("a", { price: 20 }),
          product("b", { price: 15 }),
          product("c", { price: 12 }),
          product("ring", { price: 5, categoryId: "rings" }),
        ],
        discounts: [discount({ type: "BUY_X_GET_Y", scope: "CATEGORY", categoryId: "earrings", buyQuantity: 3, getQuantity: 1 })],
      }),
    );
    assert.equal(t.discount?.amount, 12, "the $12 earring is free, not the $5 ring");
    assert.equal(t.discount?.label, "Buy 3, get 1 free");
  });

  it("keeps the better of an automatic offer and the entered code", () => {
    const t = priceBag(
      bag({
        items: [{ productId: "a", variantId: null, qty: 4 }],
        products: [product("a", { price: 20 })],
        discounts: [
          discount({ type: "BUY_X_GET_Y", buyQuantity: 3, getQuantity: 1 }), // saves $20
          discount({ code: "SAVE5", type: "AMOUNT", value: 5 }), // saves $5
        ],
        code: "SAVE5",
      }),
    );
    assert.equal(t.discount?.amount, 20);
    assert.match(t.code!.error!, /better offer/);
  });

  it("free-shipping codes zero the shipping and count it as a saving", () => {
    const t = priceBag(
      bag({
        items: [{ productId: "a", variantId: null, qty: 1 }],
        products: [product("a", { price: 30 })],
        discounts: [discount({ code: "FREESHIP", type: "FREE_SHIPPING" })],
        code: "FREESHIP",
      }),
    );
    assert.equal(t.shipping, 0);
    assert.equal(t.total, 30);
    assert.equal(t.savings, 7.95);
  });

  it("never discounts below zero", () => {
    const t = priceBag(
      bag({
        items: [{ productId: "a", variantId: null, qty: 1 }],
        products: [product("a", { price: 8 })],
        discounts: [discount({ code: "BIG", type: "AMOUNT", value: 50 })],
        code: "BIG",
      }),
    );
    assert.equal(t.discount?.amount, 8);
    assert.equal(t.total, 7.95, "items are free; shipping still applies");
  });
});

describe("tidyItems", () => {
  it("merges repeated lines and caps the quantity", () => {
    const items = tidyItems([
      { productId: "a", variantId: "gold", qty: 15 },
      { productId: "a", variantId: "gold", qty: 15 },
      { productId: "a", variantId: null, qty: 0 },
    ]);
    assert.deepEqual(items, [{ productId: "a", variantId: "gold", qty: MAX_QTY }]);
  });
});
