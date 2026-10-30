import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { checkStripeSignature, formFields } from "./stripe-sign";

test("nested data becomes Stripe form fields", () => {
  assert.deepEqual(
    formFields({
      mode: "payment",
      line_items: [{ quantity: 2, price_data: { unit_amount: 1295 } }],
      skip: undefined,
    }),
    {
      mode: "payment",
      "line_items[0][quantity]": "2",
      "line_items[0][price_data][unit_amount]": "1295",
    },
  );
});

test("only webhooks signed with our secret, and recent, are accepted", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const now = 1_800_000_000_000;
  const t = now / 1000;
  const sign = (b: string, s = secret, time = t) =>
    `t=${time},v1=${createHmac("sha256", s).update(`${time}.${b}`).digest("hex")}`;

  assert.equal(checkStripeSignature(body, sign(body), secret, now), true);
  assert.equal(
    checkStripeSignature('{"id":"evt_2"}', sign(body), secret, now),
    false,
    "body changed",
  );
  assert.equal(
    checkStripeSignature(body, sign(body, "whsec_other"), secret, now),
    false,
    "wrong secret",
  );
  assert.equal(
    checkStripeSignature(body, sign(body, secret, t - 600), secret, now),
    false,
    "too old",
  );
  assert.equal(checkStripeSignature(body, null, secret, now), false);
  assert.equal(checkStripeSignature(body, "t=abc,v1=", secret, now), false);
});
