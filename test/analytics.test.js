import assert from "node:assert/strict";
import test from "node:test";
import initSqlJs from "sql.js";
import {
  getAnalyticsSummary,
  getLiveVisitors,
  getOverviewSummary,
  recordTrackingEvent,
} from "../server/analytics.js";

async function createDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      tracking_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'pageview',
      path TEXT,
      referrer TEXT,
      user_agent TEXT,
      visitor_id TEXT,
      session_id TEXT,
      screen TEXT,
      language TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE visitor_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      visitor_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      path TEXT,
      referrer TEXT,
      user_agent TEXT,
      screen TEXT,
      language TEXT,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      UNIQUE(site_id, session_id)
    );
  `);
  db.run("INSERT INTO sites (name, url, tracking_key) VALUES (?, ?, ?)", [
    "Site One",
    "https://one.example",
    "one",
  ]);
  db.run("INSERT INTO sites (name, url, tracking_key) VALUES (?, ?, ?)", [
    "Site Two",
    "https://two.example",
    "two",
  ]);
  return db;
}

test("analytics summary returns range totals and hourly timeline", async () => {
  const db = await createDb();
  const now = "2026-07-02 12:00:00";
  recordTrackingEvent(db, 1, {
    eventType: "pageview",
    path: "/home",
    visitorId: "visitor-a",
    sessionId: "session-a",
    referrer: "Direct",
    createdAt: "2026-07-02 10:15:00",
  });
  recordTrackingEvent(db, 1, {
    eventType: "pageview",
    path: "/play",
    visitorId: "visitor-b",
    sessionId: "session-b",
    referrer: "https://google.com",
    createdAt: "2026-07-02 11:05:00",
  });
  recordTrackingEvent(db, 1, {
    eventType: "pageview",
    path: "/old",
    visitorId: "visitor-c",
    sessionId: "session-c",
    createdAt: "2026-06-01 10:00:00",
  });

  const summary = getAnalyticsSummary(db, 1, "today", now);

  assert.equal(summary.totals.pageviews, 2);
  assert.equal(summary.totals.visitors, 2);
  assert.equal(summary.timeline.length, 2);
  assert.deepEqual(summary.topPaths[0], { path: "/play", views: 1 });
  assert.deepEqual(summary.referrers[0], { referrer: "https://google.com", visits: 1 });
});

test("live visitors only include sessions seen within the active window", async () => {
  const db = await createDb();
  const now = "2026-07-02 12:00:00";
  recordTrackingEvent(db, 1, {
    eventType: "heartbeat",
    path: "/active",
    visitorId: "visitor-a",
    sessionId: "session-a",
    createdAt: "2026-07-02 11:59:35",
  });
  recordTrackingEvent(db, 1, {
    eventType: "heartbeat",
    path: "/stale",
    visitorId: "visitor-b",
    sessionId: "session-b",
    createdAt: "2026-07-02 11:57:00",
  });

  const live = getLiveVisitors(db, 1, now);

  assert.equal(live.count, 1);
  assert.equal(live.visitors[0].label, "Visitor 1");
  assert.equal(live.visitors[0].path, "/active");
});

test("overview summary aggregates pageviews, visitors, and live sessions across all sites", async () => {
  const db = await createDb();
  const now = "2026-07-02 12:00:00";
  recordTrackingEvent(db, 1, {
    eventType: "pageview",
    visitorId: "visitor-a",
    sessionId: "session-a",
    path: "/one",
    createdAt: "2026-07-02 11:59:30",
  });
  recordTrackingEvent(db, 2, {
    eventType: "pageview",
    visitorId: "visitor-b",
    sessionId: "session-b",
    path: "/two",
    createdAt: "2026-07-02 11:59:00",
  });

  const overview = getOverviewSummary(db, "today", now);

  assert.equal(overview.totals.pageviews, 2);
  assert.equal(overview.totals.visitors, 2);
  assert.equal(overview.liveVisitors, 2);
  assert.equal(overview.sites.length, 2);
});
