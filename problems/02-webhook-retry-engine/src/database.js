const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDirectory = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const databasePath = path.join(dataDirectory, "webhooks.db");

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("SQLite database connected");

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS delivery_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    http_status INTEGER,
   error_message TEXT,
next_retry_at TEXT,
attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (event_id)
      REFERENCES events(event_id)
      ON DELETE CASCADE
  );
`);
const attemptColumns = db
  .prepare("PRAGMA table_info(delivery_attempts)")
  .all();

const hasNextRetryAt = attemptColumns.some(
  (column) => column.name === "next_retry_at"
);

if (!hasNextRetryAt) {
  db.exec(`
    ALTER TABLE delivery_attempts
    ADD COLUMN next_retry_at TEXT
  `);

  console.log("Added next_retry_at column");
}

console.log("Database tables ready");

module.exports = db;