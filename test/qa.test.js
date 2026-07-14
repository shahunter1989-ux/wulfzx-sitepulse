import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATA_DIR = path.join(os.tmpdir(), `sitepulse-qa-test-${Date.now()}`);
process.env.ADMIN_PASSWORD = "test-admin-password";

const qa = await import("../server/qa.js");
await import("../server/db.js");

test("quick bug report is stored and returned from the local fallback", async () => {
  const created = await qa.createQuickBug({
    reporterName: "Tester One",
    project: "wzx-pong",
    severity: "high",
    description: "Ball clips through paddle",
  });

  assert.equal(created.ok, true);
  const reports = await qa.listQaReports({ project: "wzx-pong" });
  assert.equal(reports.quickBugs.length, 1);
  assert.equal(reports.quickBugs[0].description, "Ball clips through paddle");
});

test("full QA report stores nested bug items", async () => {
  const created = await qa.createQaReport({
    testerName: "QA Tester",
    project: "duck-fly",
    severity: "medium",
    summary: "Mobile flight test pass",
    bugs: [{ title: "Score overlaps on small screen", severity: "medium", steps: "Open on mobile" }],
  });

  assert.equal(created.ok, true);
  const reports = await qa.listQaReports({ project: "duck-fly" });
  assert.equal(reports.reports.length, 1);
  assert.equal(reports.reports[0].qa_bug_items.length, 1);
});

test("admin password check uses configured password", () => {
  assert.equal(qa.validateAdminPassword("test-admin-password"), true);
  assert.equal(qa.validateAdminPassword("wrong"), false);
});
