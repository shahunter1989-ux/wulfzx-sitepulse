const SEED_SITES = [
  { id: 1, name: "Wulfzx Main Website", url: "https://wzxu.pro", tracking_key: "wzxu-pro" },
  { id: 2, name: "Wulfzx 76 Guide", url: "https://wzxu76.pro", tracking_key: "wzxu76-pro" },
  {
    id: 3,
    name: "Duck Duck Nuke",
    url: "https://shahunter1989-ux.github.io/duck-duck-nuke/?v=launch-check",
    tracking_key: "duck-duck-nuke",
  },
  { id: 4, name: "WZX Pong", url: "https://shahunter1989-ux.github.io/wzx-pong/", tracking_key: "wzx-pong" },
  {
    id: 5,
    name: "How Far Will Your Duck Fly",
    url: "https://shahunter1989-ux.github.io/how-far-will-your-duck-fly/",
    tracking_key: "how-far-will-your-duck-fly",
  },
];

const RANGE_MS = {
  today: "today",
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,user-agent",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { ...jsonHeaders, ...(init.headers || {}) } });
}

function trackerScript() {
  return new Response(`
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
})();`, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

function normalizeRange(range) {
  return Object.hasOwn(RANGE_MS, range) ? range : "7d";
}

function cutoffFor(range, now = new Date()) {
  if (range === "all") return 0;
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return now.getTime() - RANGE_MS[range];
}

function labelFor(iso) {
  const date = new Date(iso);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:00`;
}

function deviceFor(userAgent = "") {
  if (/Tablet/i.test(userAgent)) return "Tablet";
  if (/Mobile|Android|iPhone/i.test(userAgent)) return "Mobile";
  return "Desktop";
}

function summarizeUptime(checks) {
  const latest = checks[checks.length - 1] || null;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = checks.filter((check) => new Date(check.checked_at).getTime() >= cutoff);
  const up = recent.filter((check) => check.status === "up").length;
  const avgValues = recent.map((check) => check.response_ms).filter((value) => Number.isFinite(value));
  const avgResponseMs = avgValues.length ? Math.round(avgValues.reduce((sum, value) => sum + value, 0) / avgValues.length) : null;
  const recentFailures = checks.filter((check) => check.status === "down").slice(-5).reverse();
  const slowest = checks
    .filter((check) => Number.isFinite(check.response_ms))
    .slice()
    .sort((a, b) => b.response_ms - a.response_ms)
    .slice(0, 5);

  return {
    latest,
    uptimePct: recent.length ? Math.round((up / recent.length) * 10000) / 100 : null,
    avgResponseMs,
    history: checks.slice(-48),
    recentFailures,
    slowest,
  };
}

function createDefaultData() {
  return {
    sites: SEED_SITES.map((site) => ({ ...site, created_at: new Date().toISOString() })),
    checks: [],
    events: [],
    sessions: {},
    nextCheckId: 1,
    nextEventId: 1,
  };
}

async function runUptimeCheck(site) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(site.url, {
      method: "GET",
      signal: controller.signal,
      headers: { "user-agent": "Wulfzx-SitePulse/1.0" },
    });
    return {
      site_id: site.id,
      status: response.ok ? "up" : "down",
      status_code: response.status,
      response_ms: Date.now() - started,
      error: response.ok ? null : response.statusText,
      checked_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      site_id: site.id,
      status: "down",
      status_code: null,
      response_ms: Date.now() - started,
      error: error.name === "AbortError" ? "Request timed out" : error.message,
      checked_at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export class SitePulseDO {
  constructor(state) {
    this.state = state;
  }

  async load() {
    const stored = (await this.state.storage.get("data")) || createDefaultData();
    const known = new Map(stored.sites.map((site) => [site.tracking_key, site]));
    for (const seed of SEED_SITES) {
      if (!known.has(seed.tracking_key)) stored.sites.push({ ...seed, created_at: new Date().toISOString() });
    }
    stored.sessions ||= {};
    stored.checks ||= [];
    stored.events ||= [];
    stored.nextCheckId ||= stored.checks.length + 1;
    stored.nextEventId ||= stored.events.length + 1;
    return stored;
  }

  async save(data) {
    data.events = data.events.slice(-20000);
    data.checks = data.checks.slice(-5000);
    await this.state.storage.put("data", data);
  }

  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: jsonHeaders });
    const url = new URL(request.url);
    const data = await this.load();

    if (url.pathname === "/api/sites" && request.method === "GET") {
      const origin = url.origin;
      return json(data.sites.map((site) => ({
        ...site,
        trackingScript: `<script src="${origin}/tracker.js" data-site="${site.tracking_key}"></script>`,
        uptime: summarizeUptime(data.checks.filter((check) => check.site_id === site.id)),
      })));
    }

    if (url.pathname === "/api/checks/run" && request.method === "POST") {
      const results = await Promise.all(data.sites.map(runUptimeCheck));
      for (const check of results) data.checks.push({ id: data.nextCheckId++, ...check });
      await this.save(data);
      return json({ ok: true });
    }

    if (url.pathname.startsWith("/api/track/") && request.method === "POST") {
      const key = decodeURIComponent(url.pathname.slice("/api/track/".length));
      const site = data.sites.find((item) => item.tracking_key === key);
      if (!site) return json({ error: "Unknown tracking key" }, { status: 404 });

      const payload = await request.json().catch(() => ({}));
      const createdAt = new Date().toISOString();
      const eventType = payload.eventType || "pageview";
      const visitorId = payload.visitorId || "";
      const sessionId = payload.sessionId || visitorId || `${site.id}-${Date.now()}`;
      const event = {
        id: data.nextEventId++,
        site_id: site.id,
        event_type: eventType,
        path: payload.path || "/",
        referrer: payload.referrer || "",
        user_agent: request.headers.get("user-agent") || "",
        visitor_id: visitorId,
        session_id: sessionId,
        screen: payload.screen || "",
        language: payload.language || "",
        created_at: createdAt,
      };
      data.events.push(event);

      const sessionKey = `${site.id}:${sessionId}`;
      const existing = data.sessions[sessionKey] || {};
      data.sessions[sessionKey] = {
        site_id: site.id,
        visitor_id: visitorId,
        session_id: sessionId,
        path: event.path,
        referrer: event.referrer || existing.referrer || "",
        user_agent: event.user_agent,
        screen: event.screen,
        language: event.language,
        started_at: existing.started_at || createdAt,
        last_seen_at: createdAt,
        ended_at: eventType === "exit" ? createdAt : null,
      };
      await this.save(data);
      return json({ ok: true });
    }

    const analyticsMatch = url.pathname.match(/^\/api\/analytics\/(\d+)$/);
    if (analyticsMatch && request.method === "GET") {
      return json(this.analyticsSummary(data, Number(analyticsMatch[1]), url.searchParams.get("range")));
    }

    if (url.pathname === "/api/analytics/overview" && request.method === "GET") {
      return json(this.overviewSummary(data, url.searchParams.get("range")));
    }

    const liveMatch = url.pathname.match(/^\/api\/live-visitors\/(\d+)$/);
    if (liveMatch && request.method === "GET") {
      return json(this.liveVisitors(data, Number(liveMatch[1])));
    }

    return json({ error: "Not found" }, { status: 404 });
  }

  scopedEvents(data, siteId, rangeValue) {
    const range = normalizeRange(rangeValue);
    const cutoff = cutoffFor(range);
    return data.events.filter((event) => event.site_id === siteId && new Date(event.created_at).getTime() >= cutoff);
  }

  analyticsSummary(data, siteId, rangeValue) {
    const range = normalizeRange(rangeValue);
    const events = this.scopedEvents(data, siteId, range);
    const pageviews = events.filter((event) => event.event_type === "pageview");
    const visitors = new Set(pageviews.map((event) => event.visitor_id).filter(Boolean));
    const sessions = new Set(events.map((event) => event.session_id).filter(Boolean));

    return {
      range,
      totals: { pageviews: pageviews.length, visitors: visitors.size, sessions: sessions.size },
      timeline: grouped(pageviews, (event) => labelFor(event.created_at), ["pageviews", "visitors"]),
      topPaths: topRows(pageviews, (event) => event.path || "/", "path", "views"),
      referrers: topRows(pageviews, (event) => event.referrer || "Direct", "referrer", "visits"),
      devices: countRows(pageviews, (event) => deviceFor(event.user_agent), "device", "visits"),
    };
  }

  overviewSummary(data, rangeValue) {
    const range = normalizeRange(rangeValue);
    const cutoff = cutoffFor(range);
    const events = data.events.filter((event) => new Date(event.created_at).getTime() >= cutoff);
    const pageviews = events.filter((event) => event.event_type === "pageview");
    const visitors = new Set(pageviews.map((event) => event.visitor_id).filter(Boolean));
    const sessions = new Set(events.map((event) => event.session_id).filter(Boolean));
    const liveVisitors = Object.values(data.sessions).filter((session) => isLive(session)).length;

    return {
      range,
      totals: { pageviews: pageviews.length, visitors: visitors.size, sessions: sessions.size },
      liveVisitors,
      timeline: grouped(pageviews, (event) => labelFor(event.created_at), ["pageviews", "visitors"]),
      sites: data.sites.map((site) => {
        const siteViews = pageviews.filter((event) => event.site_id === site.id);
        return {
          id: site.id,
          name: site.name,
          url: site.url,
          pageviews: siteViews.length,
          visitors: new Set(siteViews.map((event) => event.visitor_id).filter(Boolean)).size,
        };
      }),
    };
  }

  liveVisitors(data, siteId) {
    const visitors = Object.values(data.sessions)
      .filter((session) => session.site_id === siteId && isLive(session))
      .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at))
      .slice(0, 25)
      .map((session, index) => ({
        label: `Visitor ${index + 1}`,
        path: session.path || "/",
        referrer: session.referrer || "Direct",
        screen: session.screen || "",
        language: session.language || "",
        firstSeen: session.started_at,
        lastActive: session.last_seen_at,
      }));
    return { count: visitors.length, visitors };
  }
}

function isLive(session) {
  return !session.ended_at && Date.now() - new Date(session.last_seen_at).getTime() <= 60000;
}

function countRows(items, keyFn, keyName, valueName) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts, ([key, value]) => ({ [keyName]: key, [valueName]: value })).sort((a, b) => b[valueName] - a[valueName]);
}

function topRows(items, keyFn, keyName, valueName) {
  return countRows(items, keyFn, keyName, valueName).slice(0, 8);
}

function grouped(events, labelFn) {
  const groups = new Map();
  for (const event of events) {
    const label = labelFn(event);
    const group = groups.get(label) || { label, pageviews: 0, visitors: new Set() };
    group.pageviews += 1;
    if (event.visitor_id) group.visitors.add(event.visitor_id);
    groups.set(label, group);
  }
  return Array.from(groups.values()).map((group) => ({
    label: group.label,
    pageviews: group.pageviews,
    visitors: group.visitors.size,
  }));
}

function sitePulseObject(env) {
  if (env.SITEPULSE) return env.SITEPULSE.get(env.SITEPULSE.idFromName("global"));

  globalThis.__SITEPULSE_MEMORY__ ||= { data: null };
  globalThis.__SITEPULSE_MEMORY_DO__ ||= new SitePulseDO({
    storage: {
      get: async () => globalThis.__SITEPULSE_MEMORY__.data,
      put: async (_key, value) => {
        globalThis.__SITEPULSE_MEMORY__.data = value;
      },
    },
  });
  return globalThis.__SITEPULSE_MEMORY_DO__;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: jsonHeaders });
    if (url.pathname === "/tracker.js") return trackerScript();
    if (url.pathname.startsWith("/api/")) return sitePulseObject(env).fetch(request);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event, env, ctx) {
    const request = new Request("https://sitepulse.internal/api/checks/run", { method: "POST" });
    ctx.waitUntil(sitePulseObject(env).fetch(request));
  },
};
