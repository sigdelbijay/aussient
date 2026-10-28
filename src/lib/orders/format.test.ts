import { test } from "node:test";
import assert from "node:assert/strict";
import { addressLines, cleanTrackingUrl, gstIncluded, optionsText, readAddress, snapshotOptions } from "./format";

test("gstIncluded is one eleventh, to the cent", () => {
  assert.equal(gstIncluded(110), 10);
  assert.equal(gstIncluded(59.95), 5.45);
  assert.equal(gstIncluded(0), 0);
});

test("options are saved with their names and shown together", () => {
  const options = snapshotOptions(["Size", "Colour"], ["M", "Navy", null]);
  assert.deepEqual(options, [
    { name: "Size", value: "M" },
    { name: "Colour", value: "Navy" },
  ]);
  assert.equal(optionsText({ options }), "Size: M / Colour: Navy");
  assert.equal(optionsText({ options: null, variantName: "M / Navy" }), "M / Navy");
  assert.equal(optionsText({ options: [], variantName: null }), null);
});

test("addresses read safely and print as label lines", () => {
  const a = readAddress({ fullName: "Jane Smith", line1: "1 Sample St", city: "Sydney", state: "NSW", postcode: "2000" });
  assert.deepEqual(addressLines(a), ["Jane Smith", "1 Sample St", "Sydney NSW 2000", "Australia"]);
  assert.equal(readAddress("nonsense"), null);
  assert.deepEqual(addressLines(null), []);
});

test("tracking links must be web links", () => {
  assert.equal(cleanTrackingUrl("https://auspost.com.au/mypost/track/details/ABC123"), "https://auspost.com.au/mypost/track/details/ABC123");
  assert.equal(cleanTrackingUrl("javascript:alert(1)"), null);
  assert.equal(cleanTrackingUrl("not a url"), null);
  assert.equal(cleanTrackingUrl(""), null);
});
