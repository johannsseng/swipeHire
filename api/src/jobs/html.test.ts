import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDescriptionHtml } from "./html.js";

test("decodes entity-encoded markup into real HTML", () => {
  assert.equal(
    cleanDescriptionHtml("&lt;p&gt;Hello &amp; welcome&lt;/p&gt;"),
    "<p>Hello & welcome</p>"
  );
});

test("decodes &amp; last so double-encoding survives one pass", () => {
  // "&amp;lt;" should become "&lt;", not "<".
  assert.equal(cleanDescriptionHtml("&amp;lt;"), "&lt;");
});

test("decodes numeric entities and smart punctuation", () => {
  assert.equal(cleanDescriptionHtml("we&#39;re &ldquo;hiring&rdquo;"), "we're “hiring”");
});

test("strips script/style blocks", () => {
  assert.equal(
    cleanDescriptionHtml("<p>ok</p><script>alert(1)</script>"),
    "<p>ok</p>"
  );
});

test("returns null for empty/null", () => {
  assert.equal(cleanDescriptionHtml(null), null);
  assert.equal(cleanDescriptionHtml("   "), null);
});
