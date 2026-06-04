import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, buildResumeKeywords, buildTaste, scoreJob } from "./ranking.js";

const ENGINEER_JOB = {
  title: "Senior Backend Engineer",
  companyId: "c1",
  remote: true,
  postedAt: new Date(),
  descriptionText: "We use TypeScript, Postgres, and AWS to build APIs.",
};

const SALES_JOB = {
  title: "Enterprise Account Executive",
  companyId: "c2",
  remote: false,
  postedAt: new Date(),
  descriptionText: "Drive revenue through outbound sales and pipeline management.",
};

test("tokenize drops stopwords and short tokens", () => {
  const tokens = tokenize("The Senior C++ Engineer role for our team");
  assert.ok(tokens.includes("senior"));
  assert.ok(tokens.includes("c++"));
  assert.ok(!tokens.includes("the"));
  assert.ok(!tokens.includes("for"));
});

test("layer 1: resume keywords rank matching jobs higher", () => {
  const resume = buildResumeKeywords(
    "Backend engineer with 6 years of TypeScript, Postgres, AWS. Built APIs and distributed systems as a senior engineer."
  );
  const emptyTaste = buildTaste([]);
  const eng = scoreJob(ENGINEER_JOB, { resume, taste: emptyTaste });
  const sales = scoreJob(SALES_JOB, { resume, taste: emptyTaste });
  assert.ok(eng > sales, `expected engineer (${eng}) > sales (${sales})`);
});

test("resume keyword weights are frequency-dampened", () => {
  const kw = buildResumeKeywords("python python python python sql");
  assert.ok(kw["python"] > kw["sql"]);
  assert.ok(kw["python"] < kw["sql"] * 4, "12x mentions shouldn't mean 12x weight");
});

test("layer 2: swipes refine ranking on top of the scanner", () => {
  // Resume is engineering-flavored…
  const resume = buildResumeKeywords("Engineer with TypeScript and Postgres experience.");
  // …but the user keeps saving sales roles and passing engineering ones.
  const taste = buildTaste([
    { direction: "right", title: "Account Executive", companyId: "c2", remote: false },
    { direction: "right", title: "Enterprise Sales Account Manager", companyId: "c2", remote: false },
    { direction: "right", title: "Account Executive, Mid-Market", companyId: "c9", remote: false },
    { direction: "left", title: "Backend Engineer", companyId: "c1", remote: true },
    { direction: "left", title: "Senior Engineer", companyId: "c1", remote: true },
  ]);
  const eng = scoreJob(ENGINEER_JOB, { resume, taste });
  const sales = scoreJob(SALES_JOB, { resume, taste });
  assert.ok(sales > eng, `swipes should override: sales (${sales}) > engineer (${eng})`);
});

test("remote affinity is learned from saves", () => {
  const taste = buildTaste([
    { direction: "right", title: "Designer", companyId: "a", remote: true },
    { direction: "right", title: "Designer", companyId: "b", remote: true },
    { direction: "right", title: "Designer", companyId: "c", remote: true },
  ]);
  assert.ok(taste.remoteAffinity > 0);
});

test("company rating and salary lift the score", () => {
  const taste = buildTaste([]);
  const base = scoreJob(ENGINEER_JOB, { taste });
  const lifted = scoreJob(ENGINEER_JOB, {
    taste,
    rating: { avg: 4.6, count: 30 },
    hasSalary: true,
  });
  assert.ok(lifted > base);
});

test("works with no signals at all (cold start)", () => {
  const score = scoreJob(ENGINEER_JOB, {});
  assert.ok(Number.isFinite(score));
});
