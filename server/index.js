import cors from "cors";
import express from "express";
import morgan from "morgan";
import cron from "node-cron";
import { db, getSiteByTrackingKey, getSites, persistDb } from "./db.js";
import {
  getAnalyticsSummary,
  getLiveVisitors,
  getOverviewSummary,
  normalizeRange,
  recordTrackingEvent,
} from "./analytics.js";
import { getUptimeSummary, runAllUptimeChecks } from "./monitor.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "64kb" }));
app.use(morgan("dev"));

function publicBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function trackingScript(site, req) {
  const base = publicBaseUrl(req);
  return `<script src="${base}/tracker.js" data-site="${site.tracking_key}"></script>`;
}

app.get("/tracker.js", (_req, res) => {
  res.type("application/javascript").send(`
(function () {
  var script = document.currentScript;
  var site = script && script.getAttribute("data-site");
  if (!site) return;

  var origin = new URL(script.src).origin;
  var visitorKey = "wulfzx_sitepulse_visitor";
  var sessionKey = "wulfzx_sitepulse_session_" + site;
  var visitor = localStorage.getItem(visitorKey);
  if (!visitor) {
    visitor = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    localStorage.setItem(visitorKey, visitor);
  }
  var session = sessionStorage.getItem(sessionKey);
  if (!session) {
    session = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    sessionStorage.setItem(sessionKey, session);
  }

  function send(eventType) {
    fetch(origin + "/api/track/" + encodeURIComponent(site), {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventType: eventType,
      path: location.pathname + location.search,
      referrer: document.referrer,
      visitorId: visitor,
      sessionId: session,
      screen: screen.width + "x" + screen.height,
      language: navigator.language
    })
    }).catch(function () {});
  }

  send("pageview");
  setInterval(function () { send("heartbeat"); }, 25000);
  addEventListener("pagehide", function () { send("exit"); });
})();`);
});

app.get("/api/sites", (req, res) => {
  const sites = getSites().map((site) => ({
    ...site,
    trackingScript: trackingScript(site, req),
    uptime: getUptimeSummary(site.id),
  }));
  res.json(sites);
});

app.post("/api/checks/run", async (_req, res) => {
  await runAllUptimeChecks();
  res.json({ ok: true });
});

app.post("/api/track/:trackingKey", (req, res) => {
  const site = getSiteByTrackingKey(req.params.trackingKey);
  if (!site) return res.status(404).json({ error: "Unknown tracking key" });

  recordTrackingEvent(db, site.id, req.body, req.get("user-agent") || "");
  persistDb();

  res.json({ ok: true });
});

app.get("/api/analytics/overview", (req, res) => {
  res.json(getOverviewSummary(db, normalizeRange(req.query.range)));
});

app.get("/api/analytics/:siteId", (req, res) => {
  const siteId = Number(req.params.siteId);
  res.json(getAnalyticsSummary(db, siteId, normalizeRange(req.query.range)));
});

app.get("/api/live-visitors/:siteId", (req, res) => {
  res.json(getLiveVisitors(db, Number(req.params.siteId)));
});

app.use(express.static("dist"));

app.listen(port, async () => {
  console.log(`Wulfzx SitePulse backend listening on http://localhost:${port}`);
  await runAllUptimeChecks();
});

cron.schedule("*/5 * * * *", () => {
  runAllUptimeChecks().catch((error) => console.error("Uptime check failed", error));
});
