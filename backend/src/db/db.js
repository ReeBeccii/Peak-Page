// src/db/db.js
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

/**
 * WICHTIG:
 * - Wir bauen einen ABSOLUTEN Pfad, damit es nie wieder "SQLITE_CANTOPEN" gibt.
 * - Default: backend/database/library.db (weil du nodemon aus backend startest)
 */
const dbPath = path.resolve(
  process.cwd(),
  process.env.DB_PATH || "database/library.db"
);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ DB Verbindung fehlgeschlagen:", err.message);
  else console.log("✅ DB verbunden:", dbPath);
});

// Promise-Wrapper
export function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

export function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

export function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
