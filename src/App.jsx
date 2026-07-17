import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  CheckCircle2,
  Clipboard,
  FileText,
  Gauge,
  Globe2,
  Lock,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Signal,
  Upload,
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
const adminTokenKey = "wulfzx_sitepulse_admin";
const ranges = [
  ["today", "Today"],
  ["7d", "Week"],
  ["30d", "Month"],
  ["all", "All"],
];
const defaultProjects = [
  { key: "wzxu76", name: "Wulfzx 76 Guide", status: "Live QA", url: "https://wzxu76.pro" },
  { key: "duck-duck-nuke", name: "Duck Duck Nuke", status: "Launch check", url: "https://shahunter1989-ux.github.io/duck-duck-nuke/?v=launch-check" },
  { key: "wzx-pong", name: "WZX Pong", status: "Playable", url: "https://shahunter1989-ux.github.io/wzx-pong/" },
  { key: "duck-fly", name: "How Far Will Your Duck Fly", status: "Playable", url: "https://shahunter1989-ux.github.io/how-far-will-your-duck-fly/" },
  { key: "wulfzx-field-guide", name: "Wulfzx Field Guide", status: "Live QA", url: "https://wulfzx-field-guide.vercel.app/" },
];
const severities = ["low", "medium", "high", "critical"];
const statuses = ["new", "reviewing", "fixed", "closed"];

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function statusTone(status) {
  if (status === "up" || status === "fixed" || status === "closed") return "text-mint bg-mint/10 border-mint/30";
  if (status === "down" || status === "critical") return "text-red-300 bg-red-500/10 border-red-400/30";
  if (status === "high" || status === "reviewing") return "text-amber-200 bg-amber-400/10 border-amber-300/30";
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

function Sidebar({ sites, selectedId, setSelectedId, route }) {
  const nav = [
    { path: "/", label: "Part 1: Uptime Monitor", icon: Activity },
    { path: "/", label: "Part 2: Traffic Analytics", icon: BarChart3 },
    { path: "/qa", label: "Part 3: QA Portal", icon: Bug },
  ];
  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-ink px-5 py-5 lg:w-72">
      <button className="flex items-center gap-3 text-left" onClick={() => navigate("/")}>
        <div className="grid h-10 w-10 place-items-center rounded-md border border-cyan/30 bg-cyan/10">
          <Signal className="h-5 w-5 text-cyan" />
        </div>
        <div>
          <div className="text-sm font-semibold text-zinc-100">Wulfzx.Underground</div>
          <div className="text-xs text-zinc-500">Wulfzx SitePulse</div>
        </div>
      </button>

      <nav className="mt-8 space-y-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.path === "/qa" ? route.startsWith("/qa") || route.startsWith("/bug") || route.startsWith("/admin") : !route.startsWith("/qa") && !route.startsWith("/bug") && !route.startsWith("/admin");
          return (
            <button key={item.label} className={`sidebar-item w-full ${active ? "active" : ""}`} onClick={() => navigate(item.path)}>
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">Default Websites</div>
        <div className="space-y-2">
          <button onClick={() => { setSelectedId("all"); navigate("/"); }} className={`site-button ${selectedId === "all" ? "selected" : ""}`}>
            <Signal className="h-4 w-4" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">All Sites Overview</span>
              <span className="block truncate text-xs text-zinc-500">Combined Wulfzx traffic</span>
            </span>
          </button>
          {sites.map((site) => (
            <button key={site.id} onClick={() => { setSelectedId(site.id); navigate("/"); }} className={`site-button ${selectedId === site.id ? "selected" : ""}`}>
              <Globe2 className="h-4 w-4" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{site.name}</span>
                <span className="block truncate text-xs text-zinc-500">{site.url}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-2">
        <button className="icon-button justify-start" onClick={() => navigate("/bug")}><Bug className="h-4 w-4" /> Quick Bug</button>
        <button className="icon-button justify-start" onClick={() => navigate("/admin/login")}><Lock className="h-4 w-4" /> Staff Login</button>
      </div>
    </aside>
  );
}

function RangeTabs({ range, setRange }) {
  return (
    <div className="range-tabs">
      {ranges.map(([value, label]) => (
        <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{label}</button>
      ))}
    </div>
  );
}

function UptimePanel({ site }) {
  const chartData = (site?.uptime?.history || []).map((row) => ({
    time: new Date(row.checked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    response: row.response_ms || 0,
  }));
  const latest = site?.uptime?.latest;
  return (
    <section className="space-y-4">
      <div className="section-title"><ShieldCheck className="h-5 w-5 text-cyan" /><h2>Part 1: Uptime Monitor</h2></div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={CheckCircle2} label="Current Status" value={latest?.status?.toUpperCase() || "PENDING"} hint={`HTTP ${latest?.status_code || "not checked"}`} />
        <StatCard icon={Gauge} label="Response Speed" value={latest?.response_ms ? `${latest.response_ms} ms` : "-"} hint="Latest probe" />
        <StatCard icon={Activity} label="24h Uptime" value={site?.uptime?.uptimePct != null ? `${site.uptime.uptimePct}%` : "-"} hint="Rolling checks" />
      </div>
      <div className="panel h-80 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div><h3 className="font-semibold text-zinc-100">Response Speed Trend</h3><p className="text-sm text-zinc-500">Most recent uptime checks for the selected website.</p></div>
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
    </section>
  );
}

function LiveVisitorsPanel({ live }) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div><h3 className="font-semibold text-zinc-100">Live Visitors</h3><p className="text-sm text-zinc-500">Active in the last 60 seconds.</p></div>
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
      <div className="section-title"><BarChart3 className="h-5 w-5 text-cyan" /><h2>Part 2: Traffic Analytics</h2></div>
      <RangeTabs range={range} setRange={setRange} />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard icon={BarChart3} label="Pageviews" value={analytics?.totals?.pageviews || 0} hint={`${range.toUpperCase()} traffic`} />
        <StatCard icon={Users} label="Visitors" value={analytics?.totals?.visitors || 0} hint="Unique anonymous IDs" />
        <StatCard icon={Activity} label="Sessions" value={analytics?.totals?.sessions || 0} hint="Anonymous visits" />
        <StatCard icon={Signal} label="Live Now" value={live?.count || 0} hint="Last 60 seconds" />
      </div>
      <TrafficChart data={analytics?.timeline || []} title="Pageviews by Hour" />
      <LiveVisitorsPanel live={live} />
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h3 className="font-semibold text-zinc-100">Tracking Script</h3><p className="text-sm text-zinc-500">Separate script for {site.name}.</p></div>
          <button className="icon-button" onClick={copyScript} title="Copy tracking script"><Clipboard className="h-4 w-4" />{copied ? "Copied" : "Copy"}</button>
        </div>
        <pre className="script-box">{site.trackingScript}</pre>
      </div>
    </section>
  );
}

function TrafficChart({ data, title }) {
  return (
    <div className="panel h-64 p-4">
      <h3 className="mb-4 font-semibold text-zinc-100">{title}</h3>
      <ResponsiveContainer width="100%" height="82%">
        <AreaChart data={data}>
          <CartesianGrid stroke="#26333b" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#71717a" fontSize={12} />
          <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#10181d", border: "1px solid #26333b", color: "#f4f4f5" }} />
          <Area type="monotone" dataKey="pageviews" stroke="#09c8f8" fill="#09c8f833" />
          <Area type="monotone" dataKey="visitors" stroke="#2fe37b" fillOpacity={0} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function OverviewPanel({ overview, range, setRange }) {
  return (
    <section className="space-y-4">
      <div className="section-title"><Signal className="h-5 w-5 text-cyan" /><h2>All Sites Overview</h2></div>
      <RangeTabs range={range} setRange={setRange} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={BarChart3} label="Pageviews" value={overview?.totals?.pageviews || 0} hint={`${range.toUpperCase()} combined`} />
        <StatCard icon={Users} label="Visitors" value={overview?.totals?.visitors || 0} hint="Unique anonymous IDs" />
        <StatCard icon={Activity} label="Sessions" value={overview?.totals?.sessions || 0} hint="Across all sites" />
        <StatCard icon={Signal} label="Live Now" value={overview?.liveVisitors || 0} hint="All active visitors" />
      </div>
      <TrafficChart data={overview?.timeline || []} title="Combined Traffic" />
    </section>
  );
}

function Tables({ analytics }) {
  const groups = [
    ["Top Pages", analytics?.topPaths || [], "path", "views"],
    ["Referrers", analytics?.referrers || [], "referrer", "visits"],
    ["Devices", analytics?.devices || [], "device", "visits"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {groups.map(([title, rows, key, value]) => (
        <div key={title} className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">{title}</div>
          <table className="data-table"><tbody>{rows.map((row) => <tr key={row[key]}><td>{row[key]}</td><td>{row[value]}</td></tr>)}</tbody></table>
        </div>
      ))}
    </div>
  );
}

function ProjectStatusBoard({ projects }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {projects.map((project) => (
        <a key={project.key} className="panel block p-4 transition hover:border-cyan/50" href={project.url} target="_blank" rel="noreferrer">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="font-semibold text-zinc-100">{project.name}</h3><p className="mt-1 truncate text-sm text-zinc-500">{project.url}</p></div>
            <span className="rounded-md border border-mint/30 bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">{project.status}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

async function filesToUploads(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: String(reader.result).split(",")[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function Field({ label, children }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function QaHome({ projects }) {
  return (
    <section className="space-y-5">
      <div className="section-title"><Bug className="h-5 w-5 text-cyan" /><h2>Part 3: QA Portal</h2></div>
      <ProjectStatusBoard projects={projects} />
      <div className="grid gap-4 lg:grid-cols-3">
        <button className="panel qa-action" onClick={() => navigate("/bug")}><Bug className="h-5 w-5 text-cyan" /><strong>Quick Bug Report</strong><span>Fast public issue submission for players and testers.</span></button>
        <button className="panel qa-action" onClick={() => navigate("/qa")}><FileText className="h-5 w-5 text-cyan" /><strong>Full QA Tester Form</strong><span>Structured test pass with bug items and final notes.</span></button>
        <button className="panel qa-action" onClick={() => navigate("/admin/login")}><Lock className="h-5 w-5 text-cyan" /><strong>Staff Report Console</strong><span>Review, filter, and update QA report status.</span></button>
      </div>
    </section>
  );
}

function QuickBugForm({ projects }) {
  const [form, setForm] = useState({ reporterName: "", project: projects[0]?.key || "", severity: "medium", description: "" });
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  async function submit(event) {
    event.preventDefault();
    setStatus("Submitting...");
    const response = await fetch(`${apiBase}/api/qa/bugs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, uploads: await filesToUploads(files) }),
    });
    const data = await response.json();
    setStatus(response.ok ? `Bug report submitted: ${data.id}` : data.error);
    if (response.ok) setForm({ reporterName: "", project: projects[0]?.key || "", severity: "medium", description: "" });
  }
  return (
    <FormShell icon={Bug} title="Quick Bug Report" subtitle="Public lightweight issue report for Wulfzx games and guides.">
      <form className="form-grid" onSubmit={submit}>
        <Field label="Reporter name"><input value={form.reporterName} onChange={(e) => setForm({ ...form, reporterName: e.target.value })} required /></Field>
        <Field label="Project"><select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>{projects.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></Field>
        <Field label="Severity"><select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{severities.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Screenshot or video"><input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm" onChange={(e) => setFiles(e.target.files)} /></Field>
        <label className="form-field form-span"><span>Issue description</span><textarea rows={7} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
        <FormStatus status={status} />
        <button className="primary-button form-submit" type="submit"><Upload className="h-4 w-4" /> Submit Bug</button>
      </form>
    </FormShell>
  );
}

function FullQaForm({ projects }) {
  const [form, setForm] = useState({ testerName: "", testerContact: "", project: projects[0]?.key || "", buildVersion: "", device: "", browser: "", severity: "medium", summary: "", feedback: "", finalNotes: "" });
  const [bugs, setBugs] = useState([{ title: "", severity: "medium", steps: "", expected: "", actual: "" }]);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  async function submit(event) {
    event.preventDefault();
    setStatus("Submitting...");
    const response = await fetch(`${apiBase}/api/qa/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, bugs, uploads: await filesToUploads(files) }),
    });
    const data = await response.json();
    setStatus(response.ok ? `QA report submitted: ${data.id}` : data.error);
  }
  return (
    <FormShell icon={FileText} title="Full QA Tester Form" subtitle="Structured test pass with device details, bug items, attachments, and final QA notes.">
      <form className="form-grid" onSubmit={submit}>
        <Field label="Tester name"><input value={form.testerName} onChange={(e) => setForm({ ...form, testerName: e.target.value })} required /></Field>
        <Field label="Contact"><input value={form.testerContact} onChange={(e) => setForm({ ...form, testerContact: e.target.value })} /></Field>
        <Field label="Project"><select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>{projects.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></Field>
        <Field label="Build/version"><input value={form.buildVersion} onChange={(e) => setForm({ ...form, buildVersion: e.target.value })} /></Field>
        <Field label="Device"><input value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value })} /></Field>
        <Field label="Browser"><input value={form.browser} onChange={(e) => setForm({ ...form, browser: e.target.value })} /></Field>
        <Field label="Overall severity"><select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{severities.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Media"><input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm" onChange={(e) => setFiles(e.target.files)} /></Field>
        <label className="form-field form-span"><span>QA summary</span><textarea rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} required /></label>
        <div className="form-span space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-zinc-100">Bug Items</h3><button type="button" className="icon-button" onClick={() => setBugs([...bugs, { title: "", severity: "medium", steps: "", expected: "", actual: "" }])}><Plus className="h-4 w-4" /> Add Bug</button></div>
          {bugs.map((bug, index) => (
            <div className="bug-item" key={index}>
              <Field label="Bug title"><input value={bug.title} onChange={(e) => setBugs(bugs.map((b, i) => i === index ? { ...b, title: e.target.value } : b))} /></Field>
              <Field label="Severity"><select value={bug.severity} onChange={(e) => setBugs(bugs.map((b, i) => i === index ? { ...b, severity: e.target.value } : b))}>{severities.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <label className="form-field"><span>Steps</span><textarea value={bug.steps} onChange={(e) => setBugs(bugs.map((b, i) => i === index ? { ...b, steps: e.target.value } : b))} /></label>
              <label className="form-field"><span>Expected</span><textarea value={bug.expected} onChange={(e) => setBugs(bugs.map((b, i) => i === index ? { ...b, expected: e.target.value } : b))} /></label>
              <label className="form-field"><span>Actual</span><textarea value={bug.actual} onChange={(e) => setBugs(bugs.map((b, i) => i === index ? { ...b, actual: e.target.value } : b))} /></label>
            </div>
          ))}
        </div>
        <label className="form-field form-span"><span>Feedback notes</span><textarea rows={4} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} /></label>
        <label className="form-field form-span"><span>Final QA summary</span><textarea rows={4} value={form.finalNotes} onChange={(e) => setForm({ ...form, finalNotes: e.target.value })} /></label>
        <FormStatus status={status} />
        <button className="primary-button form-submit" type="submit"><Upload className="h-4 w-4" /> Submit QA Report</button>
      </form>
    </FormShell>
  );
}

function FormShell({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div className="section-title"><Icon className="h-5 w-5 text-cyan" /><h2>{title}</h2></div>
      <p className="text-sm text-zinc-500">{subtitle}</p>
      <div className="panel p-4 md:p-6">{children}</div>
    </section>
  );
}

function FormStatus({ status }) {
  if (!status) return null;
  return <div className="form-span rounded-md border border-line bg-ink p-3 text-sm text-zinc-300">{status}</div>;
}

function AdminLogin() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  async function submit(event) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) return setStatus(data.error || "Login failed");
    localStorage.setItem(adminTokenKey, data.token);
    navigate("/admin/reports");
  }
  return (
    <FormShell icon={Lock} title="Staff Login" subtitle="Admin access for reviewing private QA reports.">
      <form className="form-grid" onSubmit={submit}>
        <Field label="Admin password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <FormStatus status={status} />
        <button className="primary-button form-submit" type="submit"><Lock className="h-4 w-4" /> Log In</button>
      </form>
    </FormShell>
  );
}

function AdminReports({ projects }) {
  const [data, setData] = useState({ reports: [], quickBugs: [] });
  const [filters, setFilters] = useState({ project: "", severity: "", status: "" });
  const [error, setError] = useState("");
  const token = localStorage.getItem(adminTokenKey);

  async function load() {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => value)));
    const response = await fetch(`${apiBase}/api/qa/reports?${params}`, { headers: { authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Admin login required");
      return;
    }
    setError("");
    setData(body);
  }

  async function patchReport(id, updates) {
    await fetch(`${apiBase}/api/qa/reports/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    load();
  }

  useEffect(() => {
    if (!token) navigate("/admin/login");
    else load();
  }, [filters.project, filters.severity, filters.status]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="section-title"><ShieldCheck className="h-5 w-5 text-cyan" /><h2>Admin Reports</h2></div>
        <button className="icon-button" onClick={() => { localStorage.removeItem(adminTokenKey); navigate("/admin/login"); }}>Log out</button>
      </div>
      <div className="panel grid gap-3 p-4 md:grid-cols-3">
        <Field label="Project"><select value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })}><option value="">All projects</option>{projects.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></Field>
        <Field label="Severity"><select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}><option value="">All severities</option>{severities.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Status"><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      {error && <div className="panel p-4 text-red-200">{error}</div>}
      <ReportList title="Full QA Reports" rows={data.reports || []} projectName={projectName(projects)} onPatch={patchReport} />
      <QuickBugList rows={data.quickBugs || []} projectName={projectName(projects)} />
    </section>
  );
}

function projectName(projects) {
  return (key) => projects.find((project) => project.key === key)?.name || key;
}

function ReportList({ title, rows, projectName, onPatch }) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">{title}</div>
      <div className="divide-y divide-line">
        {rows.map((row) => (
          <div className="report-row" key={row.id}>
            <div>
              <div className="font-semibold text-zinc-100">{row.summary}</div>
              <div className="mt-1 text-sm text-zinc-500">{projectName(row.project)} / {row.tester_name} / {new Date(row.created_at).toLocaleString()}</div>
              {!!row.qa_bug_items?.length && <div className="mt-2 text-sm text-zinc-400">{row.qa_bug_items.length} bug item(s)</div>}
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <select value={row.status} onChange={(e) => onPatch(row.id, { status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
              <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusTone(row.severity)}`}>{row.severity}</span>
            </div>
          </div>
        ))}
        {!rows.length && <div className="p-4 text-sm text-zinc-500">No full QA reports yet.</div>}
      </div>
    </div>
  );
}

function QuickBugList({ rows, projectName }) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-3 font-semibold text-zinc-100">Quick Bug Reports</div>
      <div className="divide-y divide-line">
        {rows.map((row) => (
          <div className="report-row" key={row.id}>
            <div><div className="font-semibold text-zinc-100">{row.description}</div><div className="mt-1 text-sm text-zinc-500">{projectName(row.project)} / {row.reporter_name} / {new Date(row.created_at).toLocaleString()}</div></div>
            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusTone(row.severity)}`}>{row.severity}</span>
          </div>
        ))}
        {!rows.length && <div className="p-4 text-sm text-zinc-500">No quick bug reports yet.</div>}
      </div>
    </div>
  );
}

function AppRoute({ route, projects, sitesState }) {
  const { selectedId, range, analytics, overview, live, sites, selectedSite, setRange, runChecks } = sitesState;
  if (route === "/bug") return <QuickBugForm projects={projects} />;
  if (route === "/qa") return <FullQaForm projects={projects} />;
  if (route === "/admin/login") return <AdminLogin />;
  if (route === "/admin/reports") return <AdminReports projects={projects} />;
  if (route.startsWith("/qa") || route.startsWith("/admin")) return <QaHome projects={projects} />;
  const isOverview = selectedId === "all";
  return (
    <>
      <header className="mb-6 flex flex-col justify-between gap-4 border-b border-line pb-5 md:flex-row md:items-center">
        <div><h1 className="text-2xl font-semibold tracking-normal text-zinc-50">Wulfzx SitePulse</h1><p className="mt-1 text-sm text-zinc-500">{isOverview ? "All Wulfzx properties" : `${selectedSite?.name} / ${selectedSite?.url}`}</p></div>
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
          <div className="mt-5"><Tables analytics={analytics} /></div>
        </>
      )}
    </>
  );
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [sites, setSites] = useState([]);
  const [projects, setProjects] = useState(defaultProjects);
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
    const updateRoute = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", updateRoute);
    return () => window.removeEventListener("popstate", updateRoute);
  }, []);
  useEffect(() => {
    loadSites();
    fetch(`${apiBase}/api/qa/projects`).then((response) => response.json()).then(setProjects).catch(() => {});
    const id = setInterval(loadSites, 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (selectedId === "all") {
      fetch(`${apiBase}/api/analytics/overview?range=${range}`).then((response) => response.json()).then(setOverview);
      setLive(null);
      return;
    }
    fetch(`${apiBase}/api/analytics/${selectedId}?range=${range}`).then((response) => response.json()).then(setAnalytics);
    fetch(`${apiBase}/api/live-visitors/${selectedId}`).then((response) => response.json()).then(setLive);
  }, [selectedId, range]);

  const selectedSite = useMemo(() => sites.find((site) => site.id === selectedId) || sites[0], [sites, selectedId]);
  const state = { selectedId, range, analytics, overview, live, sites, selectedSite, setRange, runChecks };

  if (loading) return <div className="grid min-h-screen place-items-center bg-ink text-zinc-100">Loading Wulfzx SitePulse...</div>;

  return (
    <div className="min-h-screen bg-ink text-zinc-100 lg:grid lg:grid-cols-[18rem_1fr]">
      <Sidebar sites={sites} selectedId={selectedId} setSelectedId={setSelectedId} route={route} />
      <main className="min-w-0 px-5 py-5 lg:px-7">
        <AppRoute route={route} projects={projects} sitesState={state} />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
