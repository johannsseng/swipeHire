import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCompanyInbox } from "./inbox.js";

test("prefers a manually-set recruiter email", () => {
  const inbox = resolveCompanyInbox({
    recruiterEmail: "talent@stripe.com",
    recruiterName: "Jane Doe",
    website: "https://stripe.com",
  });
  assert.equal(inbox.email, "talent@stripe.com");
  assert.equal(inbox.kind, "manual");
  assert.equal(inbox.label, "Jane Doe");
});

test("falls back to careers@<domain> from the website", () => {
  const inbox = resolveCompanyInbox({
    recruiterEmail: null,
    website: "https://www.stripe.com/jobs",
  });
  assert.equal(inbox.email, "careers@stripe.com");
  assert.equal(inbox.kind, "careers");
});

test("handles a bare domain without scheme", () => {
  const inbox = resolveCompanyInbox({ recruiterEmail: null, website: "stripe.com" });
  assert.equal(inbox.email, "careers@stripe.com");
});

test("returns no inbox when there's nothing to derive from", () => {
  const inbox = resolveCompanyInbox({ recruiterEmail: null, website: null });
  assert.equal(inbox.email, null);
  assert.equal(inbox.kind, null);
});

test("ignores an unparseable website", () => {
  const inbox = resolveCompanyInbox({ recruiterEmail: null, website: "not a url" });
  assert.equal(inbox.email, null);
});
