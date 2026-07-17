import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { all, run } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const localUploadDir = path.join(dataDir, "qa-uploads");
const maxUploadBytes = 25 * 1024 * 1024;
const allowedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const qaProjects = [
  { key: "wzxu76", name: "Wulfzx 76 Guide", status: "Live QA", url: "https://wzxu76.pro" },
  { key: "duck-duck-nuke", name: "Duck Duck Nuke", status: "Launch check", url: "https://shahunter1989-ux.github.io/duck-duck-nuke/?v=launch-check" },
  { key: "wzx-pong", name: "WZX Pong", status: "Playable", url: "https://shahunter1989-ux.github.io/wzx-pong/" },
  { key: "duck-fly", name: "How Far Will Your Duck Fly", status: "Playable", url: "https://shahunter1989-ux.github.io/how-far-will-your-duck-fly/" },
  { key: "wulfzx-field-guide", name: "Wulfzx Field Guide", status: "Live QA", url: "https://wulfzx-field-guide.vercel.app/" },
];

function supabaseConfig() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    url: process.env.SUPABASE_URL.replace(/\/$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function headers(config) {
  return {
    apikey: config.key,
    authorization: `Bearer ${config.key}`,
  };
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] || "").trim());
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

function validateUploads(files = []) {
  for (const file of files) {
    if (!file?.name || !file?.type || !file?.data) continue;
    if (!allowedTypes.has(file.type)) {
      const error = new Error(`Unsupported file type: ${file.type}`);
      error.status = 400;
      throw error;
    }
    const bytes = Buffer.from(file.data, "base64");
    if (bytes.length > maxUploadBytes) {
      const error = new Error(`${file.name} is over the 25 MB upload limit`);
      error.status = 400;
      throw error;
    }
  }
}

function safeName(name) {
  return String(name || "upload").replace(/[^a-z0-9._-]/gi, "-").slice(0, 96);
}

async function uploadFiles(files = [], ownerType, ownerId) {
  validateUploads(files);
  if (!files.length) return [];

  const config = supabaseConfig();
  fs.mkdirSync(localUploadDir, { recursive: true });

  const uploads = [];
  for (const file of files) {
    const bytes = Buffer.from(file.data, "base64");
    const storagePath = `${ownerType}/${ownerId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    if (config) {
      const response = await fetch(`${config.url}/storage/v1/object/qa-uploads/${storagePath}`, {
        method: "POST",
        headers: {
          ...headers(config),
          "content-type": file.type,
          "x-upsert": "false",
        },
        body: bytes,
      });
      if (!response.ok) throw new Error(`Supabase upload failed for ${file.name}: ${await response.text()}`);
      uploads.push({ name: file.name, type: file.type, size: bytes.length, path: storagePath });
    } else {
      const target = path.join(localUploadDir, storagePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
      uploads.push({ name: file.name, type: file.type, size: bytes.length, path: target });
    }
  }
  return uploads;
}

async function supabaseInsert(table, payload) {
  const config = supabaseConfig();
  if (!config) return null;
  const response = await fetch(`${config.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...headers(config),
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Supabase insert failed for ${table}: ${await response.text()}`);
  return (await response.json())[0];
}

async function supabaseSelectReports(query = {}) {
  const config = supabaseConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    select: "*,qa_bug_items(*)",
    order: "created_at.desc",
    limit: "100",
  });
  if (query.project) params.set("project", `eq.${query.project}`);
  if (query.severity) params.set("severity", `eq.${query.severity}`);
  if (query.status) params.set("status", `eq.${query.status}`);

  const response = await fetch(`${config.url}/rest/v1/qa_reports?${params}`, {
    headers: headers(config),
  });
  if (!response.ok) throw new Error(`Supabase report fetch failed: ${await response.text()}`);
  const fullReports = await response.json();

  const bugParams = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: "100",
  });
  if (query.project) bugParams.set("project", `eq.${query.project}`);
  if (query.severity) bugParams.set("severity", `eq.${query.severity}`);
  if (query.status) bugParams.set("status", `eq.${query.status}`);
  const bugResponse = await fetch(`${config.url}/rest/v1/bug_reports?${bugParams}`, { headers: headers(config) });
  if (!bugResponse.ok) throw new Error(`Supabase bug fetch failed: ${await bugResponse.text()}`);

  return { reports: fullReports, quickBugs: await bugResponse.json() };
}

async function supabasePatchReport(id, updates) {
  const config = supabaseConfig();
  if (!config) return null;
  const response = await fetch(`${config.url}/rest/v1/qa_reports?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...headers(config),
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error(`Supabase report update failed: ${await response.text()}`);
  return (await response.json())[0];
}

export function ensureQaSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS qa_reports (
      id TEXT PRIMARY KEY,
      tester_name TEXT NOT NULL,
      tester_contact TEXT,
      project TEXT NOT NULL,
      build_version TEXT,
      device TEXT,
      browser TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'new',
      summary TEXT NOT NULL,
      feedback TEXT,
      final_notes TEXT,
      uploads_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS qa_bug_items (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      steps TEXT,
      expected TEXT,
      actual TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bug_reports (
      id TEXT PRIMARY KEY,
      reporter_name TEXT NOT NULL,
      project TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'new',
      description TEXT NOT NULL,
      uploads_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function createQuickBug(body) {
  requireFields(body, ["reporterName", "project", "description"]);
  const id = crypto.randomUUID();
  const uploads = await uploadFiles(body.uploads || [], "quick-bugs", id);
  const payload = {
    id,
    reporter_name: body.reporterName.trim(),
    project: body.project,
    severity: body.severity || "medium",
    status: "new",
    description: body.description.trim(),
    uploads_json: uploads,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const supabaseRow = await supabaseInsert("bug_reports", payload);
  if (!supabaseRow) {
    run(
      "INSERT INTO bug_reports (id, reporter_name, project, severity, status, description, uploads_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [payload.id, payload.reporter_name, payload.project, payload.severity, payload.status, payload.description, JSON.stringify(payload.uploads_json), payload.created_at, payload.updated_at]
    );
  }
  return { ok: true, id };
}

export async function createQaReport(body) {
  requireFields(body, ["testerName", "project", "summary"]);
  const id = crypto.randomUUID();
  const uploads = await uploadFiles(body.uploads || [], "qa-reports", id);
  const payload = {
    id,
    tester_name: body.testerName.trim(),
    tester_contact: body.testerContact || "",
    project: body.project,
    build_version: body.buildVersion || "",
    device: body.device || "",
    browser: body.browser || "",
    severity: body.severity || "medium",
    status: "new",
    summary: body.summary.trim(),
    feedback: body.feedback || "",
    final_notes: body.finalNotes || "",
    uploads_json: uploads,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const bugItems = (body.bugs || [])
    .filter((bug) => String(bug.title || "").trim())
    .map((bug) => ({
      id: crypto.randomUUID(),
      report_id: id,
      title: bug.title.trim(),
      severity: bug.severity || "medium",
      steps: bug.steps || "",
      expected: bug.expected || "",
      actual: bug.actual || "",
      created_at: new Date().toISOString(),
    }));

  const supabaseRow = await supabaseInsert("qa_reports", payload);
  if (supabaseRow) {
    for (const bug of bugItems) await supabaseInsert("qa_bug_items", bug);
  } else {
    run(
      `INSERT INTO qa_reports
      (id, tester_name, tester_contact, project, build_version, device, browser, severity, status, summary, feedback, final_notes, uploads_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.id, payload.tester_name, payload.tester_contact, payload.project, payload.build_version, payload.device, payload.browser, payload.severity, payload.status, payload.summary, payload.feedback, payload.final_notes, JSON.stringify(payload.uploads_json), payload.created_at, payload.updated_at]
    );
    for (const bug of bugItems) {
      run(
        "INSERT INTO qa_bug_items (id, report_id, title, severity, steps, expected, actual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [bug.id, bug.report_id, bug.title, bug.severity, bug.steps, bug.expected, bug.actual, bug.created_at]
      );
    }
  }
  return { ok: true, id };
}

function parseUploads(row) {
  try {
    return JSON.parse(row.uploads_json || "[]");
  } catch {
    return [];
  }
}

export async function listQaReports(query = {}) {
  const supabaseRows = await supabaseSelectReports(query);
  if (supabaseRows) return supabaseRows;

  const filters = [];
  const params = [];
  for (const field of ["project", "severity", "status"]) {
    if (query[field]) {
      filters.push(`${field} = ?`);
      params.push(query[field]);
    }
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const reports = all(`SELECT * FROM qa_reports ${where} ORDER BY created_at DESC LIMIT 100`, params).map((report) => ({
    ...report,
    uploads: parseUploads(report),
    qa_bug_items: all("SELECT * FROM qa_bug_items WHERE report_id = ? ORDER BY created_at ASC", [report.id]),
  }));
  const quickBugs = all(`SELECT * FROM bug_reports ${where} ORDER BY created_at DESC LIMIT 100`, params).map((bug) => ({
    ...bug,
    uploads: parseUploads(bug),
  }));

  return { reports, quickBugs };
}

export async function updateQaReport(id, updates) {
  const allowed = {
    status: updates.status,
    severity: updates.severity,
    updated_at: new Date().toISOString(),
  };
  Object.keys(allowed).forEach((key) => allowed[key] == null && delete allowed[key]);
  const supabaseRow = await supabasePatchReport(id, allowed);
  if (!supabaseRow) {
    run("UPDATE qa_reports SET status = COALESCE(?, status), severity = COALESCE(?, severity), updated_at = ? WHERE id = ?", [
      allowed.status || null,
      allowed.severity || null,
      allowed.updated_at,
      id,
    ]);
  }
  return { ok: true };
}

export function createAdminToken() {
  const secret = process.env.ADMIN_PASSWORD || "wulfzx-admin";
  return crypto.createHmac("sha256", secret).update("wulfzx-sitepulse-admin").digest("hex");
}

export function validateAdminPassword(password) {
  const expected = process.env.ADMIN_PASSWORD || "wulfzx-admin";
  const actual = Buffer.from(String(password || ""));
  const target = Buffer.from(expected);
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}

export function isAdminToken(token) {
  return token && token === createAdminToken();
}
