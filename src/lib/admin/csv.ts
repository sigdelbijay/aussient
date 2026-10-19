/**
 * Tiny CSV reader/writer (RFC 4180: commas, "quoted, fields", "" for a quote,
 * line breaks inside quotes). Enough for spreadsheet exports from Excel,
 * Numbers and Google Sheets.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, ""); // Excel's byte-order mark

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Ignore blank lines.
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Rows as objects keyed by the (trimmed, lower-cased) header row. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  // Undo the ' that toCsv() puts before formula-like text.
  const clean = (v: string) => v.trim().replace(/^'(?=[=+\-@])/, "");
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, clean(r[i] ?? "")])));
}

function escape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  // Stop spreadsheets running cells that start with =, +, - or @ as formulas.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}
