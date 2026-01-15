// api/migrate.js
const fs = require("fs");
const path = require("path");
const db = require("./db");

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function getAppliedMigrations() {
  const rows = db
    .prepare("SELECT name FROM schema_migrations ORDER BY applied_at ASC")
    .all();
  return new Set(rows.map((r) => r.name));
}

function markApplied(name) {
  db.prepare(
    "INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES (?, ?)"
  ).run(name, new Date().toISOString());
}

// Heuristic “already satisfied?” checks so we can adopt this safely mid-stream.
function isSatisfied(filename) {
  if (filename.startsWith("001_")) {
    const t = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='applications'"
      )
      .get();
    return !!t;
  }

  if (filename.startsWith("002_")) {
    const cols = db
      .prepare("PRAGMA table_info(applications)")
      .all()
      .map((c) => c.name);
    return (
      cols.includes("last_signal_mark") &&
      cols.includes("last_bearing_at") &&
      cols.includes("last_drift_detected_at")
    );
  }

  if (filename.startsWith("003_")) {
    const t = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='application_events'"
      )
      .get();
    return !!t;
  }

  // Default: not satisfied (will run)
  return false;
}

function runMigrations() {
  ensureMigrationsTable();
  const applied = getAppliedMigrations();

  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    // If this migration is already satisfied (because it ran before we tracked),
    // just record it and move on.
    if (isSatisfied(file)) {
      markApplied(file);
      console.log(`✅ already satisfied: ${file}`);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, "utf8");

    db.exec(sql);
    markApplied(file);
    console.log(`✅ migrated: ${file}`);
  }
}

runMigrations();
