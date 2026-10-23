import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterKey, formatSpec, parseSpecInput, readSpecFields, readSpecs, variantLabel, type SpecField } from "./product-types";

// Run with: pnpm test

const caseSize: SpecField = { label: "Case size", kind: "number", unit: "mm", filterable: true };
const movement: SpecField = { label: "Movement", kind: "pick", choices: ["Quartz", "Automatic"] };
const hypo: SpecField = { label: "Hypoallergenic", kind: "yes-no" };

describe("product types", () => {
  it("reads spec fields and ignores bad data", () => {
    assert.deepEqual(readSpecFields([caseSize, { label: "", kind: "text" }]), []);
    assert.deepEqual(readSpecFields([caseSize, movement]), [caseSize, movement]);
    assert.deepEqual(readSpecFields("nope"), []);
  });

  it("keeps only text, number and yes/no spec values", () => {
    assert.deepEqual(readSpecs({ Material: "Steel", "Case size": 38, Hypoallergenic: true, Bad: { x: 1 } }), {
      Material: "Steel",
      "Case size": 38,
      Hypoallergenic: true,
    });
    assert.deepEqual(readSpecs(null), {});
  });

  it("formats specs for shoppers", () => {
    assert.equal(formatSpec(caseSize, 38), "38 mm");
    assert.equal(formatSpec(hypo, true), "Yes");
    assert.equal(formatSpec(movement, "Quartz"), "Quartz");
  });

  it("parses admin form input by kind", () => {
    assert.equal(parseSpecInput(caseSize, " 40 "), 40);
    assert.deepEqual(parseSpecInput(caseSize, "big"), { error: "Case size must be a number" });
    assert.equal(parseSpecInput(caseSize, ""), undefined);
    assert.equal(parseSpecInput(movement, "quartz"), "Quartz", "matches the list, whatever the case");
    assert.ok(typeof parseSpecInput(movement, "Solar") === "object");
    assert.equal(parseSpecInput(hypo, "on"), true);
    assert.equal(parseSpecInput(hypo, undefined), false);
  });

  it("names variants and filters", () => {
    assert.equal(variantLabel(["M", "Navy", null]), "M / Navy");
    assert.equal(variantLabel([null, null, null]), null);
    assert.equal(filterKey("Strap colour"), "strap-colour");
    assert.equal(filterKey("Case size (mm)"), "case-size-mm");
  });
});
