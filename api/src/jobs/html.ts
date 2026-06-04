// Description cleanup utilities.
//
// Job-board feeds (Greenhouse in particular) deliver descriptions as
// HTML-entity-ENCODED markup, e.g. the literal string "&lt;p&gt;Hello&lt;/p&gt;".
// When that string is handed to an HTML renderer it decodes the entities into
// the *text* "<p>Hello</p>" and shows the tags verbatim instead of formatting.
//
// `cleanDescriptionHtml` decodes the entities once so the value becomes real
// markup ("<p>Hello</p>") that a renderer formats correctly. It is idempotent
// for already-decoded markup in practice (real HTML rarely contains &lt;/&gt;).

const NAMED: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#x27;": "'",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": "”",
  "&ldquo;": "“",
  "&bull;": "•",
  "&trade;": "™",
  "&reg;": "®",
  "&copy;": "©",
};

function decodeEntities(input: string): string {
  let out = input;
  for (const [entity, char] of Object.entries(NAMED)) {
    out = out.split(entity).join(char);
  }
  // Numeric entities (decimal + hex).
  out = out.replace(/&#(\d+);/g, (_, n) => safeCodePoint(parseInt(n, 10)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCodePoint(parseInt(n, 16)));
  // Decode &amp; LAST so "&amp;lt;" becomes "&lt;" rather than "<".
  out = out.split("&amp;").join("&");
  return out;
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function cleanDescriptionHtml(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const decoded = decodeEntities(raw)
    // Drop scripts/styles defensively — they have no place in a JD render.
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .trim();
  return decoded.length ? decoded : null;
}
