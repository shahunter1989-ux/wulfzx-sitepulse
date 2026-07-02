import { all, get, getSites, run } from "./db.js";

export async function runUptimeCheck(site) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(site.url, {
      method: "GET",
      signal: controller.signal,
      headers: { "user-agent": "Wulfzx-SitePulse/1.0" },
    });
    const responseMs = Math.round(performance.now() - started);
    const status = response.ok ? "up" : "down";

    run(
      "INSERT INTO uptime_checks (site_id, status, status_code, response_ms, error) VALUES (?, ?, ?, ?, ?)",
      [site.id, status, response.status, responseMs, response.ok ? null : response.statusText]
    );
  } catch (error) {
    run(
      "INSERT INTO uptime_checks (site_id, status, status_code, response_ms, error) VALUES (?, ?, ?, ?, ?)",
      [site.id, "down", null, Math.round(performance.now() - started), error.name === "AbortError" ? "Request timed out" : error.message]
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function runAllUptimeChecks() {
  const sites = getSites();
  await Promise.all(sites.map((site) => runUptimeCheck(site)));
}

export function getUptimeSummary(siteId) {
  const latest = get("SELECT * FROM uptime_checks WHERE site_id = ? ORDER BY checked_at DESC, id DESC LIMIT 1", [siteId]);

  const stats = get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
        ROUND(AVG(response_ms)) as avg_response_ms
      FROM uptime_checks
      WHERE site_id = ? AND checked_at >= datetime('now', '-24 hours')
    `, [siteId]);

  const history = all(`
      SELECT status, status_code, response_ms, checked_at
      FROM uptime_checks
      WHERE site_id = ?
      ORDER BY checked_at DESC, id DESC
      LIMIT 48
    `, [siteId])
    .reverse();

  const uptimePct = stats.total ? Math.round((stats.up_count / stats.total) * 10000) / 100 : null;
  return { latest, uptimePct, avgResponseMs: stats.avg_response_ms, history };
}
