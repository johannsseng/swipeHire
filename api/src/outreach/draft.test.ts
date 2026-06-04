import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDraft } from "./draft.js";

test("greets a named recruiter by first name", () => {
  const { body } = buildDraft({
    applicantName: "Sam Rivera",
    applicantHeadline: "a backend engineer",
    applicantLinks: null,
    jobTitle: "Staff Engineer",
    companyName: "Stripe",
    recruiterName: "Jane Doe",
  });
  assert.match(body, /^Hi Jane,/);
  assert.match(body, /Sam Rivera$/);
});

test("addresses the company team when there's no named recruiter", () => {
  const { subject, body } = buildDraft({
    applicantName: null,
    applicantHeadline: null,
    applicantLinks: null,
    jobTitle: "Designer",
    companyName: "Notion",
    recruiterName: null,
  });
  assert.match(body, /^Hi Notion hiring team,/);
  assert.equal(subject, "Interested in the Designer role at Notion");
});

test("includes provided links", () => {
  const { body } = buildDraft({
    applicantName: "A",
    applicantHeadline: null,
    applicantLinks: { linkedin: "https://linkedin.com/in/a", github: "https://github.com/a" },
    jobTitle: "Eng",
    companyName: "Acme",
    recruiterName: null,
  });
  assert.match(body, /LinkedIn: https:\/\/linkedin\.com\/in\/a/);
  assert.match(body, /GitHub: https:\/\/github\.com\/a/);
});
