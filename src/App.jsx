import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clipboard,
  Gauge,
  Globe2,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Signal,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";

const apiBase = import.meta.env.VITE_API_BASE_URL || "";
const ranges = [
  ["today", "Today"],
  ["7d", "Week"],
  ["30d", "Month"],
  ["all", "All"],
];

function statusTone(status) {
  if (status === "up") return "text-mint bg-mint/10 border-mint/30";
  if (status === "down") return "text-red-300 bg-red-500/10 border-red-400/30";
  return "text-zinc-300 bg-zinc-500/10 border-zinc-400/20";
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</span>
        <Icon className="h-4 w-4 text-cyan" />
      </div>
      <div className="mt-3 text-2xl font-semibold text-zinc-50">{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{hint}</div>
    </div>
  );
}

function Sidebar({ sites, selectedId, setSelectedId }) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-ink px-5 py-5 lg:w-72">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md border border-cyan/30 bg-cyan/10">
          <Signal className="h-5 w-5 text-cyan" />
        </div>
        <div>
          <div className="text-sm font-semibold text-zinc-100">Wulfzx.Underground</div>
          <div className="text-xs text-zinc-500">Wulfzx SitePulse</div>
        </div>
      </div>

      <nav className="mt-8 space-y-2">
        <div className="sidebar-item active"><Activity className="h-4 w-4" /> Part 1: Uptime Monitor</div>
        <div className="sidebar-item"><BarChart3 className="h-4 w-4" /> Part 2: Traffic Analytics</div>
      </nav>

      <div className="mt-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">Default Websites</div>
        <div className="space-y-2">
          <button
            onClick={() => setSelectedId("all")}
            className={`site-button ${selectedId === "all" ? "selected" : ""}`}
          >
            <Signal className="h-4 w-4" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">All Sites Overview</span>
              <span className="block truncate text-xs text-zinc-500">Combined Wulfzx traffic</span>
            </span>
          </button>
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => setSelectedId(site.id)}
              className={`site-button ${selectedId === site.id ? "selected" : ""}`}
            >
              <Globe2 className="h-4 w-4" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{site.name}</span>
                <span className="block truncate text-xs text-zinc-500">{site.url}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function RangeTabs({ range, setRange }) {
  return (
    <div className="range-tabs">
      {ranges.map(([value, label]) => (
        <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function UptimePanel({ site }) {
  const chartData = (site?.uptime?.history || []).map((row) => ({
    time: new Date(row.checked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    response: row.response_ms || 0,
    status: row.status === "up" ? 1 : 0,
  }));
  const latest = site?.uptime?.latest;

  return (
    <section className="space-y-4">
      <div className="section-title">
        <ShieldCheck className="h-5 w-5 text-cyan" />
        <h2>Part 1: Uptime Monitor</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={CheckCircle2} label="Current Status" value={latest?.status?.toUpperCase() || "PENDING"} hint={`HTTP ${latest?.status_code || "not checked"}`} />
        <StatCard icon={Gauge} label="Response Speed" value={latest?.response_ms ? `${latest.response_ms} ms` : "-"} hint="Latest probe" />
        <StatCard icon={Activity} label="24h Uptime" value={site?.uptime?.uptimePct != null ? `${site.uptime.uptimePct}%` : "-"} hint="Rolling checks" />
      </div>

      <div className="panel h-80 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-zinc-100">Response Speed Trend</h3>
            <p className="text-sm text-zinc-500">Most recent uptime checks for the selected website.</p>
          </div>
          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusTone(latest?.status)}`}>{latest?.status || "pending"}</span>
        </div>
        <ResponsiveContainer width="100%" height="78%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#26333b" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} />
            <Tooltip contentStyle={{ background: "#10181d", border: "1px solid #26333b", color: "#f4f4f5" }} />
            <Line type="monotone" dataKey="response" stroke="#09c8f8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">Recent Failures</div>
          <table className="data-table">
            <tbody>
              {(site?.uptime?.recentFailures || []).map((row) => (
                <tr key={`${row.checked_at}-${row.error}`}><td>{row.error || `HTTP ${row.status_code || "down"}`}</td><td>{row.response_ms || "-"} ms</td></tr>
              ))}
              {!site?.uptime?.recentFailures?.length && <tr><td>No recent failures</td><td>OK</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">Slowest Checks</div>
          <table className="data-table">
            <tbody>
              {(site?.uptime?.slowest || []).map((row) => (
                <tr key={`${row.checked_at}-${row.response_ms}`}><td>{new Date(row.checked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td><td>{row.response_ms || "-"} ms</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LiveVisitorsPanel({ live }) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-100">Live Visitors</h3>
          <p className="text-sm text-zinc-500">Active in the last 60 seconds.</p>
        </div>
        <div className="text-2xl font-semibold text-cyan">{live?.count || 0}</div>
      </div>
      <div className="space-y-2">
        {(live?.visitors || []).slice(0, 5).map((visitor) => (
          <div key={`${visitor.label}-${visitor.lastActive}`} className="live-row">
            <span className="font-semibold text-zinc-100">{visitor.label}</span>
            <span className="truncate text-zinc-500">{visitor.path}</span>
            <span className="text-zinc-600">{new Date(visitor.lastActive).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
        {!live?.count && <div className="text-sm text-zinc-500">No active visitors right now.</div>}
      </div>
    </div>
  );
}

function AnalyticsPanel({ site, analytics, live, range, setRange }) {
  const [copied, setCopied] = useState(false);

  async function copyScript() {
    await navigator.clipboard.writeText(site.trackingScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="space-y-4">
      <div className="section-title">
        <BarChart3 className="h-5 w-5 text-cyan" />
        <h2>Part 2: Traffic Analytics</h2>
      </div>
      <RangeTabs range={range} setRange={setRange} />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard icon={BarChart3} label="Pageviews" value={analytics?.totals?.pageviews || 0} hint={`${range.toUpperCase()} traffic`} />
        <StatCard icon={Users} label="Visitors" value={analytics?.totals?.visitors || 0} hint="Unique anonymous IDs" />
        <StatCard icon={Activity} label="Sessions" value={analytics?.totals?.sessions || 0} hint="Anonymous visits" />
        <StatCard icon={Signal} label="Live Now" value={live?.count || 0} hint="Last 60 seconds" />
      </div>

      <div className="panel h-64 p-4">
        <h3 className="mb-4 font-semibold text-zinc-100">Pageviews by Hour</h3>
        <ResponsiveContainer width="100%" height="82%">
          <AreaChart data={analytics?.timeline || []}>
            <defs>
              <linearGradient id="pageviews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#09c8f8" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#09c8f8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#26333b" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#10181d", border: "1px solid #26333b", color: "#f4f4f5" }} />
            <Area type="monotone" dataKey="pageviews" stroke="#09c8f8" fill="url(#pageviews)" />
            <Area type="monotone" dataKey="visitors" stroke="#2fe37b" fillOpacity={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <LiveVisitorsPanel live={live} />

      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-100">Tracking Script</h3>
            <p className="text-sm text-zinc-500">Separate script for {site.name}.</p>
          </div>
          <button className="icon-button" onClick={copyScript} title="Copy tracking script">
            <Clipboard className="h-4 w-4" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="script-box">{site.trackingScript}</pre>
      </div>
    </section>
  );
}

function OverviewPanel({ overview, range, setRange }) {
  return (
    <section className="space-y-4">
      <div className="section-title">
        <Signal className="h-5 w-5 text-cyan" />
        <h2>All Sites Overview</h2>
      </div>
      <RangeTabs range={range} setRange={setRange} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={BarChart3} label="Pageviews" value={overview?.totals?.pageviews || 0} hint={`${range.toUpperCase()} combined`} />
        <StatCard icon={Users} label="Visitors" value={overview?.totals?.visitors || 0} hint="Unique anonymous IDs" />
        <StatCard icon={Activity} label="Sessions" value={overview?.totals?.sessions || 0} hint="Across all sites" />
        <StatCard icon={Signal} label="Live Now" value={overview?.liveVisitors || 0} hint="All active visitors" />
      </div>
      <div className="panel h-72 p-4">
        <h3 className="mb-4 font-semibold text-zinc-100">Combined Traffic</h3>
        <ResponsiveContainer width="100%" height="82%">
          <AreaChart data={overview?.timeline || []}>
            <CartesianGrid stroke="#26333b" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#10181d", border: "1px solid #26333b", color: "#f4f4f5" }} />
            <Area type="monotone" dataKey="pageviews" stroke="#09c8f8" fill="#09c8f833" />
            <Area type="monotone" dataKey="visitors" stroke="#2fe37b" fillOpacity={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">Sites by Traffic</div>
        <table className="data-table">
          <tbody>{(overview?.sites || []).map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.pageviews} views / {row.visitors} visitors</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Tables({ analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">Top Pages</div>
        <table className="data-table">
          <tbody>{(analytics?.topPaths || []).map((row) => <tr key={row.path}><td>{row.path}</td><td>{row.views}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">Referrers</div>
        <table className="data-table">
          <tbody>{(analytics?.referrers || []).map((row) => <tr key={row.referrer}><td>{row.referrer}</td><td>{row.visits}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">Devices</div>
        <table className="data-table">
          <tbody>{(analytics?.devices || []).map((row) => <tr key={row.device}><td>{row.device}</td><td>{row.visits}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [sites, setSites] = useState([]);
  const [selectedId, setSelectedId] = useState("all");
  const [range, setRange] = useState("today");
  const [analytics, setAnalytics] = useState(null);
  const [overview, setOverview] = useState(null);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadSites() {
    const response = await fetch(`${apiBase}/api/sites`);
    const data = await response.json();
    setSites(data);
    setLoading(false);
  }

  async function runChecks() {
    await fetch(`${apiBase}/api/checks/run`, { method: "POST" });
    await loadSites();
  }

  useEffect(() => {
    loadSites();
    const id = setInterval(loadSites, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedId === "all") {
      fetch(`${apiBase}/api/analytics/overview?range=${range}`)
        .then((response) => response.json())
        .then(setOverview);
      setLive(null);
      return;
    }
    fetch(`${apiBase}/api/analytics/${selectedId}?range=${range}`)
      .then((response) => response.json())
      .then(setAnalytics);
    fetch(`${apiBase}/api/live-visitors/${selectedId}`)
      .then((response) => response.json())
      .then(setLive);
  }, [selectedId, range]);

  const selectedSite = useMemo(() => sites.find((site) => site.id === selectedId) || sites[0], [sites, selectedId]);
  const isOverview = selectedId === "all";

  if (loading) return <div className="grid min-h-screen place-items-center bg-ink text-zinc-100">Loading Wulfzx SitePulse...</div>;

  return (
    <div className="min-h-screen bg-ink text-zinc-100 lg:grid lg:grid-cols-[18rem_1fr]">
      <Sidebar sites={sites} selectedId={isOverview ? "all" : selectedSite?.id} setSelectedId={setSelectedId} />
      <main className="min-w-0 px-5 py-5 lg:px-7">
        <header className="mb-6 flex flex-col justify-between gap-4 border-b border-line pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-50">Wulfzx SitePulse</h1>
            <p className="mt-1 text-sm text-zinc-500">{isOverview ? "All Wulfzx properties" : `${selectedSite?.name} · ${selectedSite?.url}`}</p>
          </div>
          <button className="primary-button" onClick={runChecks}><RefreshCw className="h-4 w-4" /> Run Uptime Checks</button>
        </header>

        {isOverview ? (
          <OverviewPanel overview={overview} range={range} setRange={setRange} />
        ) : (
          <>
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <UptimePanel site={selectedSite} />
              {selectedSite && <AnalyticsPanel site={selectedSite} analytics={analytics} live={live} range={range} setRange={setRange} />}
            </div>
            <div className="mt-5">
              <Tables analytics={analytics} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
