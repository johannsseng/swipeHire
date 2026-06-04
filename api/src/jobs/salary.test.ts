import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSalary } from "./salary.js";

test("extracts a dollar range", () => {
  assert.equal(
    extractSalary("Compensation: $120,000 - $160,000 per year, plus equity."),
    "$120,000 - $160,000 per year"
  );
});

test("extracts a k-notation range", () => {
  assert.match(extractSalary("Pay is $120k–$160k depending on level.") ?? "", /\$120k.*\$160k/);
});

test("extracts a single hourly figure", () => {
  assert.equal(extractSalary("This role pays $45/hour."), "$45/hour");
});

test("returns null when no salary is present", () => {
  assert.equal(extractSalary("We are looking for a great engineer."), null);
});

test("handles null/empty input", () => {
  assert.equal(extractSalary(null), null);
  assert.equal(extractSalary(""), null);
});

test("ignores stray dollar amounts without a period/range", () => {
  assert.equal(extractSalary("Our office snacks cost $5 each."), null);
});
