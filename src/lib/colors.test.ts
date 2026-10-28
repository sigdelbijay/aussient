import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accentCss, textOn } from "./colors";

describe("accent colour", () => {
  it("picks readable text", () => {
    assert.equal(textOn("#e6007e"), "#ffffff"); // hot pink
    assert.equal(textOn("#ffd400"), "#16161a"); // yellow
    assert.equal(textOn("#000000"), "#ffffff");
  });

  it("only lets a plain #rrggbb colour into the CSS", () => {
    assert.equal(accentCss("#E6007E"), ":root{--brand-accent:#e6007e;--brand-accent-foreground:#ffffff}");
    assert.equal(accentCss("red;}body{display:none"), "");
    assert.equal(accentCss(null), "");
  });
});
