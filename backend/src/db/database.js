const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "..", "..", "data", "modelflow.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    format TEXT NOT NULL,
    filepath TEXT NOT NULL,
    rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'uploaded',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    nodes TEXT DEFAULT '[]',
    edges TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    dataset_id TEXT,
    pipeline_id TEXT,
    metrics TEXT DEFAULT '{}',
    filepath TEXT,
    status TEXT DEFAULT 'training',
    multilingual BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    results TEXT DEFAULT '{}',
    error TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );
`);

// Migration for existing databases
try {
  db.exec(`ALTER TABLE models ADD COLUMN multilingual BOOLEAN DEFAULT 0;`);
} catch (err) {
  // Ignore error if column already exists
}

module.exports = db;
