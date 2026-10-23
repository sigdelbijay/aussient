import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_QTY } from "@/lib/catalog-shared";
import { priceBag, tidyItems, type PricingDiscount, type PricingInput, type PricingProduct } from "./pricing";

// Run with: pnpm test

const NOW = new Date("2026-10-13T00:00:00Z");

type Variant = PricingProduct["variants"][number];

/**
 * A product with no options: one default variant ("<id>-v") holding the price
 * and stock. Pass `variants` to give it options instead.
 */
function product(
  id: string,
  {
    price = 20,
    salePrice = null,
    stock = 50,
    ...overrides
  }: Partial<PricingProduct> & { price?: number; salePrice?: number | null; stock?: number } = {},
): PricingProduct {
  return {
    id,
    slug: id,
    name: id,
    live: true,
    categoryIds: ["earrings"],
    image: null,
    variants: [{ id: `${id}-v`, label: null, price, salePrice, stock, image: null }],
    ...overrides,
  };
}

const variant = (id: string, label: string, price: number, stock = 10, salePrice: number | null = null): Variant => ({
  id,
  label,
  price,
  salePrice,
  stock,
  image: null,
});

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

  it("uses each variant's own price and stock", () => {
    const p = product("a", {
      variants: [variant("gold", "Gold", 29.95, 2), variant("silver", "Silver", 24.95, 0)],
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
    assert.equal(gold.variantName, "Gold");
    assert.equal(t.subtotal, 59.9, "sold-out variant isn't charged");
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
          product("ring", { price: 5, categoryIds: ["rings"] }),
        ],
        discounts: [discount({ type: "BUY_X_GET_Y", scope: "CATEGORY", categoryId: "earrings", buyQuantity: 3, getQuantity: 1 })],
      }),
    );
    assert.equal(t.discount?.amount, 12, "the $12 earring is free, not the $5 ring");
    assert.equal(t.discount?.label, "Buy 3, get 1 free");
  });

  it("prices multi-option variants (Size × Colour) and rejects combinations that don't exist", () => {
    const tee = product("tee", {
      categoryIds: ["t-shirts", "clothing"],
      variants: [
        variant("s-navy", "S / Navy", 39.95),
        variant("m-navy", "M / Navy", 39.95, 1),
        variant("xl-navy", "XL / Navy", 44.95, 10, 34.95),
      ],
    });
    const t = priceBag(
      bag({
        items: [
          { productId: "tee", variantId: "m-navy", qty: 2 },
          { productId: "tee", variantId: "xl-navy", qty: 1 },
          { productId: "tee", variantId: "xl-white", qty: 1 }, // deleted / never existed
          { productId: "tee", variantId: null, qty: 1 }, // no size/colour picked
        ],
        products: [tee],
      }),
    );
    const [m, xl, white, none] = t.lines;
    assert.equal(m.variantName, "M / Navy");
    assert.equal(m.qty, 1, "only 1 M / Navy left");
    assert.equal(xl.unitPrice, 34.95);
    assert.equal(xl.compareAtPrice, 44.95);
    assert.equal(white.issue, "unavailable");
    assert.equal(none.issue, "unavailable", "a product with several variants needs one picked");
    assert.equal(t.subtotal, 74.9); // 39.95 + 34.95
  });

  it("applies a category discount to products in categories inside it", () => {
    // The product is in "T-shirts", which sits inside "Clothing" (both listed by calculateTotals).
    const t = priceBag(
      bag({
        items: [
          { productId: "tee", variantId: null, qty: 1 },
          { productId: "watch", variantId: null, qty: 1 },
        ],
        products: [
          product("tee", { price: 40, categoryIds: ["t-shirts", "clothing"] }),
          product("watch", { price: 100, categoryIds: ["watches"] }),
        ],
        discounts: [discount({ scope: "CATEGORY", categoryId: "clothing", value: 25 })],
      }),
    );
    assert.equal(t.discount?.amount, 10, "25% off the $40 tee only");
  });

  it("reads old bags that saved a product without a variant", () => {
    const t = priceBag(
      bag({
        items: [
          { productId: "a", variantId: null, qty: 1 }, // saved before products had variants
          { productId: "a", variantId: "a-v", qty: 2 },
        ],
        products: [product("a", { price: 10 })],
      }),
    );
    assert.equal(t.lines.length, 1, "both lines are the same variant, so they merge");
    assert.equal(t.lines[0].variantId, "a-v");
    assert.equal(t.lines[0].qty, 3);
    assert.equal(t.subtotal, 30);
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
