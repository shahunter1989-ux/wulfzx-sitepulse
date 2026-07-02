import cors from "cors";
import express from "express";
import morgan from "morgan";
import cron from "node-cron";
import { all, get, getSiteByTrackingKey, getSites, run } from "./db.js";
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
  var visitor = localStorage.getItem(visitorKey);
  if (!visitor) {
    visitor = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    localStorage.setItem(visitorKey, visitor);
  }

  fetch(origin + "/api/track/" + encodeURIComponent(site), {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventType: "pageview",
      path: location.pathname + location.search,
      referrer: document.referrer,
      visitorId: visitor,
      screen: screen.width + "x" + screen.height,
      language: navigator.language
    })
  }).catch(function () {});
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

  run(`
    INSERT INTO analytics_events
    (site_id, event_type, path, referrer, user_agent, visitor_id, screen, language)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    site.id,
    req.body.eventType || "pageview",
    req.body.path || "/",
    req.body.referrer || "",
    req.get("user-agent") || "",
    req.body.visitorId || "",
    req.body.screen || "",
    req.body.language || "",
  ]);

  res.json({ ok: true });
});

app.get("/api/analytics/:siteId", (req, res) => {
  const siteId = Number(req.params.siteId);
  const totals = get(`
    SELECT
      COUNT(*) as pageviews,
      COUNT(DISTINCT visitor_id) as visitors
    FROM analytics_events
    WHERE site_id = ? AND created_at >= datetime('now', '-7 days')
  `, [siteId]);

  const timeline = all(`
    SELECT strftime('%m-%d %H:00', created_at) as label, COUNT(*) as pageviews
    FROM analytics_events
    WHERE site_id = ? AND created_at >= datetime('now', '-24 hours')
    GROUP BY label
    ORDER BY MIN(created_at)
  `, [siteId]);

  const topPaths = all(`
    SELECT COALESCE(NULLIF(path, ''), '/') as path, COUNT(*) as views
    FROM analytics_events
    WHERE site_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY path
    ORDER BY views DESC
    LIMIT 8
  `, [siteId]);

  const referrers = all(`
    SELECT COALESCE(NULLIF(referrer, ''), 'Direct') as referrer, COUNT(*) as visits
    FROM analytics_events
    WHERE site_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY referrer
    ORDER BY visits DESC
    LIMIT 8
  `, [siteId]);

  res.json({ totals, timeline, topPaths, referrers });
});

app.use(express.static("dist"));

app.listen(port, async () => {
  console.log(`Wulfzx SitePulse backend listening on http://localhost:${port}`);
  await runAllUptimeChecks();
});

cron.schedule("*/5 * * * *", () => {
  runAllUptimeChecks().catch((error) => console.error("Uptime check failed", error));
});
