import sqlite3 from "sqlite3";
import dotenv from "dotenv";
dotenv.config();

const dbPath = process.env.DB_PATH || "../database/library.db";

// sqlite3 arbeitet callback-basiert.
// Wir bauen kleine Promise-Wrapper, damit Controller sauber bleiben.
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ DB Verbindung fehlgeschlagen:", err.message);
  else console.log("✅ DB verbunden:", dbPath);
});

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
