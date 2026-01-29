// src/db/db.js
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

// ==================================================
// DATENBANK (SQLite)
// Zuständig für DB-Verbindung + Promise-Wrapper (dbAll / dbGet / dbRun)
// ==================================================

/**
 * DB-Pfad (wichtig für stabile Starts)
 * -----------------------------------
 * - Es wird ein ABSOLUTER Pfad verwendet, um "SQLITE_CANTOPEN" zuverlässig zu vermeiden.
 * - Standard: database/library.db
 *   (passt z. B. wenn nodemon aus dem backend-Verzeichnis gestartet wird)
 *
 * Hinweis:
 * - Über DB_PATH kann der Pfad per .env überschrieben werden.
 */
const dbPath = path.resolve(
  process.cwd(),
  process.env.DB_PATH || "database/library.db"
);

/**
 * Stellt die Verbindung zur SQLite-Datenbank her.
 * Loggt Erfolg/Fehler inklusive verwendetem Pfad.
 */
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ DB Verbindung fehlgeschlagen:", err.message);
  else console.log("✅ DB verbunden:", dbPath);
});

// ==================================================
// PROMISE-WRAPPER
// Zuständig dafür, dass sqlite3-Callbacks als Promises genutzt werden können
// ==================================================

/**
 * Führt ein SQL-Statement aus und liefert ALLE Treffer als Array zurück.
 * (entspricht sqlite3: db.all)
 */
export function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

/**
 * Führt ein SQL-Statement aus und liefert GENAU einen Treffer zurück.
 * (entspricht sqlite3: db.get)
 */
export function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

/**
 * Führt ein SQL-Statement aus, das Daten verändert (INSERT/UPDATE/DELETE).
 * Gibt lastID (bei INSERT) und changes (Anzahl Änderungen) zurück.
 * (entspricht sqlite3: db.run)
 */
export function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}