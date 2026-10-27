import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromShopInput, toShopInput } from "./dates";

describe("shop dates (Sydney time)", () => {
  it("reads typed times as Sydney time, in and out of daylight saving", () => {
    // November: daylight saving (UTC+11). June: standard time (UTC+10).
    assert.equal(fromShopInput("2026-11-01T09:00")!.toISOString(), "2026-10-31T22:00:00.000Z");
    assert.equal(fromShopInput("2026-06-01T09:00")!.toISOString(), "2026-05-31T23:00:00.000Z");
  });
  it("round-trips and handles blanks and junk", () => {
    assert.equal(toShopInput(fromShopInput("2026-12-24T18:30")), "2026-12-24T18:30");
    assert.equal(fromShopInput(""), null);
    assert.equal(toShopInput(null), "");
    assert.ok(Number.isNaN(fromShopInput("next tuesday")!.getTime()));
  });
});
