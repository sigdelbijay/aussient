import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanRichText, plainText, safeHref } from "./rich-text";

describe("cleanRichText", () => {
  it("keeps headings, lists, bold text and safe links", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Shipping" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Free over $50. ", marks: [{ type: "bold" }] },
            { type: "text", text: "Returns", marks: [{ type: "link", attrs: { href: "/pages/returns", target: "_blank" } }] },
          ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Tracked" }] }] }] },
      ],
    };
    assert.deepEqual(cleanRichText(doc), {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Shipping" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Free over $50. ", marks: [{ type: "bold" }] },
            { type: "text", text: "Returns", marks: [{ type: "link", attrs: { href: "/pages/returns" } }] },
          ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Tracked" }] }] }] },
      ],
    });
  });

  it("drops unknown nodes, script links and odd heading levels", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "iframe", attrs: { src: "https://evil.example" } },
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Big" }] },
        { type: "paragraph", content: [{ type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "textStyle" }] }] },
      ],
    };
    assert.deepEqual(cleanRichText(doc)?.content, [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Big" }] },
      { type: "paragraph", content: [{ type: "text", text: "Click" }] },
    ]);
  });

  it("rejects things that aren't documents", () => {
    assert.equal(cleanRichText("<p>hi</p>"), null);
    assert.equal(cleanRichText({ type: "paragraph" }), null);
  });
});

describe("safeHref", () => {
  it("allows shop paths, websites, email and phone links only", () => {
    assert.equal(safeHref("/pages/faq"), "/pages/faq");
    assert.equal(safeHref("https://instagram.com/aussient"), "https://instagram.com/aussient");
    assert.equal(safeHref("mailto:hello@aussient.com.au"), "mailto:hello@aussient.com.au");
    assert.equal(safeHref("tel:+61400000000"), "tel:+61400000000");
    assert.equal(safeHref("//evil.example"), null);
    assert.equal(safeHref("javascript:alert(1)"), null);
    assert.equal(safeHref(" JavaScript:alert(1)"), null);
  });
});

describe("plainText", () => {
  it("joins the words of every block", () => {
    const doc = cleanRichText({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "About" }] },
        { type: "paragraph", content: [{ type: "text", text: "Made in  Sydney." }] },
      ],
    });
    assert.equal(plainText(doc), "About Made in Sydney.");
  });
});
