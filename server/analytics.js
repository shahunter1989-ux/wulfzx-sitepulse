const RANGE_SQL = {
  today: "datetime(:now, 'start of day')",
  "7d": "datetime(:now, '-7 days')",
  "30d": "datetime(:now, '-30 days')",
  all: null,
};

function rows(db, sql, params = {}) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  stmt.free();
  return result;
}

function row(db, sql, params = {}) {
  return rows(db, sql, params)[0];
}

function rangeClause(range, tableAlias = "") {
  const expression = RANGE_SQL[range] ?? RANGE_SQL["7d"];
  if (!expression) return "";
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `AND ${prefix}created_at >= ${expression.replace(":now", "?")}`;
}

export function normalizeRange(range) {
  return Object.hasOwn(RANGE_SQL, range) ? range : "7d";
}

export function ensureAnalyticsSchema(db) {
  const eventColumns = rows(db, "PRAGMA table_info(analytics_events)").map((column) => column.name);
  if (!eventColumns.includes("session_id")) {
    db.run("ALTER TABLE analytics_events ADD COLUMN session_id TEXT");
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS visitor_sessions (
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
}

export function recordTrackingEvent(db, siteId, payload, userAgent = "") {
  const eventType = payload.eventType || "pageview";
  const createdAt = payload.createdAt || new Date().toISOString().replace("T", " ").slice(0, 19);
  const visitorId = payload.visitorId || "";
  const sessionId = payload.sessionId || visitorId || `${siteId}-${Date.now()}`;
  const path = payload.path || "/";
  const referrer = payload.referrer || "";
  const screen = payload.screen || "";
  const language = payload.language || "";

  db.run(
    `
      INSERT INTO analytics_events
      (site_id, event_type, path, referrer, user_agent, visitor_id, session_id, screen, language, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [siteId, eventType, path, referrer, userAgent, visitorId, sessionId, screen, language, createdAt]
  );

  db.run(
    `
      INSERT INTO visitor_sessions
      (site_id, visitor_id, session_id, path, referrer, user_agent, screen, language, started_at, last_seen_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(site_id, session_id) DO UPDATE SET
        path = excluded.path,
        referrer = COALESCE(NULLIF(excluded.referrer, ''), visitor_sessions.referrer),
        user_agent = excluded.user_agent,
        screen = excluded.screen,
        language = excluded.language,
        last_seen_at = excluded.last_seen_at,
        ended_at = CASE WHEN excluded.ended_at IS NOT NULL THEN excluded.ended_at ELSE visitor_sessions.ended_at END
    `,
    [
      siteId,
      visitorId,
      sessionId,
      path,
      referrer,
      userAgent,
      screen,
      language,
      createdAt,
      createdAt,
      eventType === "exit" ? createdAt : null,
    ]
  );
}

export function getAnalyticsSummary(db, siteId, range = "7d", now = "now") {
  const normalizedRange = normalizeRange(range);
  const whereRange = rangeClause(normalizedRange);
  const rangeParams = normalizedRange === "all" ? [] : [now];

  const totals = row(
    db,
    `
      SELECT
        SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews,
        COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN visitor_id END) as visitors,
        COUNT(DISTINCT session_id) as sessions
      FROM analytics_events
      WHERE site_id = ? ${whereRange}
    `,
    [siteId, ...rangeParams]
  );

  const timeline = rows(
    db,
    `
      SELECT
        strftime('%m-%d %H:00', created_at) as label,
        SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews,
        COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN visitor_id END) as visitors
      FROM analytics_events
      WHERE site_id = ? ${whereRange}
      GROUP BY label
      ORDER BY MIN(created_at)
    `,
    [siteId, ...rangeParams]
  );

  const topPaths = rows(
    db,
    `
      SELECT COALESCE(NULLIF(path, ''), '/') as path, COUNT(*) as views
      FROM analytics_events
      WHERE site_id = ? AND event_type = 'pageview' ${whereRange}
      GROUP BY path
      ORDER BY views DESC, MAX(created_at) DESC, path ASC
      LIMIT 8
    `,
    [siteId, ...rangeParams]
  );

  const referrers = rows(
    db,
    `
      SELECT COALESCE(NULLIF(referrer, ''), 'Direct') as referrer, COUNT(*) as visits
      FROM analytics_events
      WHERE site_id = ? AND event_type = 'pageview' ${whereRange}
      GROUP BY referrer
      ORDER BY visits DESC, MAX(created_at) DESC, referrer ASC
      LIMIT 8
    `,
    [siteId, ...rangeParams]
  );

  const devices = rows(
    db,
    `
      SELECT
        CASE
          WHEN user_agent LIKE '%Mobile%' THEN 'Mobile'
          WHEN user_agent LIKE '%Tablet%' THEN 'Tablet'
          ELSE 'Desktop'
        END as device,
        COUNT(*) as visits
      FROM analytics_events
      WHERE site_id = ? AND event_type = 'pageview' ${whereRange}
      GROUP BY device
      ORDER BY visits DESC
    `,
    [siteId, ...rangeParams]
  );

  return {
    range: normalizedRange,
    totals: {
      pageviews: totals?.pageviews || 0,
      visitors: totals?.visitors || 0,
      sessions: totals?.sessions || 0,
    },
    timeline,
    topPaths,
    referrers,
    devices,
  };
}

export function getLiveVisitors(db, siteId, now = "now") {
  const visitors = rows(
    db,
    `
      SELECT visitor_id, session_id, path, referrer, screen, language, started_at, last_seen_at
      FROM visitor_sessions
      WHERE site_id = ?
        AND ended_at IS NULL
        AND last_seen_at >= datetime(?, '-60 seconds')
      ORDER BY last_seen_at DESC
      LIMIT 25
    `,
    [siteId, now]
  ).map((visitor, index) => ({
    label: `Visitor ${index + 1}`,
    path: visitor.path || "/",
    referrer: visitor.referrer || "Direct",
    screen: visitor.screen || "",
    language: visitor.language || "",
    firstSeen: visitor.started_at,
    lastActive: visitor.last_seen_at,
  }));

  return { count: visitors.length, visitors };
}

export function getOverviewSummary(db, range = "7d", now = "now") {
  const normalizedRange = normalizeRange(range);
  const whereRange = rangeClause(normalizedRange, "e");
  const rangeParams = normalizedRange === "all" ? [] : [now];

  const totals = row(
    db,
    `
      SELECT
        SUM(CASE WHEN e.event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews,
        COUNT(DISTINCT CASE WHEN e.event_type = 'pageview' THEN e.visitor_id END) as visitors,
        COUNT(DISTINCT e.session_id) as sessions
      FROM analytics_events e
      WHERE 1 = 1 ${whereRange}
    `,
    rangeParams
  );

  const sites = rows(
    db,
    `
      SELECT
        s.id,
        s.name,
        s.url,
        COUNT(CASE WHEN e.event_type = 'pageview' THEN 1 END) as pageviews,
        COUNT(DISTINCT CASE WHEN e.event_type = 'pageview' THEN e.visitor_id END) as visitors
      FROM sites s
      LEFT JOIN analytics_events e ON e.site_id = s.id ${whereRange}
      GROUP BY s.id
      ORDER BY pageviews DESC, s.id ASC
    `,
    rangeParams
  );

  const timeline = rows(
    db,
    `
      SELECT
        strftime('%m-%d %H:00', e.created_at) as label,
        SUM(CASE WHEN e.event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews,
        COUNT(DISTINCT CASE WHEN e.event_type = 'pageview' THEN e.visitor_id END) as visitors
      FROM analytics_events e
      WHERE 1 = 1 ${whereRange}
      GROUP BY label
      ORDER BY MIN(e.created_at)
    `,
    rangeParams
  );

  const liveVisitors = row(
    db,
    `
      SELECT COUNT(*) as count
      FROM visitor_sessions
      WHERE ended_at IS NULL AND last_seen_at >= datetime(?, '-60 seconds')
    `,
    [now]
  );

  return {
    range: normalizedRange,
    totals: {
      pageviews: totals?.pageviews || 0,
      visitors: totals?.visitors || 0,
      sessions: totals?.sessions || 0,
    },
    liveVisitors: liveVisitors?.count || 0,
    timeline,
    sites,
  };
}
