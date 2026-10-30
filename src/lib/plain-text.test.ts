import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText } from "./plain-text";

test("plain text is left alone (just tidied)", () => {
  assert.equal(
    htmlToText("  Soft cotton tee.\n\n\n\nMade in Australia.  "),
    "Soft cotton tee.\n\nMade in Australia.",
  );
  assert.equal(htmlToText("Fits 3 < 5 sizes"), "Fits 3 < 5 sizes");
});

test("HTML becomes text with its line breaks", () => {
  assert.equal(
    htmlToText(
      "<p>Soft <strong>cotton</strong>.</p><ul><li>Machine wash</li><li>Dry flat</li></ul>",
    ),
    "Soft cotton.\n\n• Machine wash\n• Dry flat",
  );
  assert.equal(htmlToText("Line one<br>Line two<br/>Line three"), "Line one\nLine two\nLine three");
  assert.equal(
    htmlToText("Fish &amp; chips &#8211; &quot;yum&quot;&nbsp;!"),
    'Fish & chips – "yum" !',
  );
});

test("scripts, styles, comments and encoded tags are removed", () => {
  assert.equal(
    htmlToText('<p>Hi</p><script>alert("x")</script><style>p{}</style><!-- note -->'),
    "Hi",
  );
  assert.equal(htmlToText('<img src=x onerror="alert(1)">Nice'), "Nice");
  assert.equal(htmlToText("&lt;script&gt;alert(1)&lt;/script&gt;Hello"), "alert(1)Hello");
});
