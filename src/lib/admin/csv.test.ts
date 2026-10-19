import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseCsvObjects, toCsv } from "./csv";

describe("csv", () => {
  it("reads quotes, commas, doubled quotes and line breaks inside quotes", () => {
    const rows = parseCsv('name,description\r\n"Hoops, gold","Say ""hi""\nline two"\r\n\r\nStuds,plain\n');
    assert.deepEqual(rows, [
      ["name", "description"],
      ["Hoops, gold", 'Say "hi"\nline two'],
      ["Studs", "plain"],
    ]);
  });

  it("maps rows to lower-cased headers and ignores Excel's byte-order mark", () => {
    assert.deepEqual(parseCsvObjects("﻿Name,Price\nRing,24.95"), [{ name: "Ring", price: "24.95" }]);
  });

  it("round-trips through toCsv, neutralising spreadsheet formulas", () => {
    const csv = toCsv(["a", "b", "c"], [["=SUM(A1)", 'x, "y"', -5], [null, "line\nbreak", 0]]);
    assert.match(csv, /^a,b,c\r\n'=SUM\(A1\),"x, ""y""",-5\r\n/);
    assert.deepEqual(parseCsvObjects(csv), [
      { a: "=SUM(A1)", b: 'x, "y"', c: "-5" },
      { a: "", b: "line\nbreak", c: "0" },
    ]);
  });
});
