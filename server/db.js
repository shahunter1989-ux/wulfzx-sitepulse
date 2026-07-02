import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "sitepulse.db");

const SQL = await initSqlJs();
const source = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
export const db = new SQL.Database(source);

export function persistDb() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

export function run(sql, params = []) {
  db.run(sql, params);
  persistDb();
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function get(sql, params = []) {
  return all(sql, params)[0];
}

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    tracking_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uptime_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    status_code INTEGER,
    response_ms INTEGER,
    error TEXT,
    checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'pageview',
    path TEXT,
    referrer TEXT,
    user_agent TEXT,
    visitor_id TEXT,
    screen TEXT,
    language TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
  );
`);
persistDb();

const seedSites = [
  ["Wulfzx Main Website", "https://wzxu.pro", "wzxu-pro"],
  ["Wulfzx 76 Guide", "https://wzxu76.pro", "wzxu76-pro"],
  ["Duck Duck Nuke", "https://shahunter1989-ux.github.io/duck-duck-nuke/?v=launch-check", "duck-duck-nuke"],
  ["WZX Pong", "https://shahunter1989-ux.github.io/wzx-pong/", "wzx-pong"],
  ["How Far Will Your Duck Fly", "https://shahunter1989-ux.github.io/how-far-will-your-duck-fly/", "how-far-will-your-duck-fly"],
];

for (const site of seedSites) {
  run("INSERT OR IGNORE INTO sites (name, url, tracking_key) VALUES (?, ?, ?)", site);
  run("UPDATE sites SET name = ?, tracking_key = ? WHERE url = ?", [site[0], site[2], site[1]]);
}

export function getSiteByTrackingKey(key) {
  return get("SELECT * FROM sites WHERE tracking_key = ?", [key]);
}

export function getSites() {
  return all("SELECT * FROM sites ORDER BY id ASC");
}
