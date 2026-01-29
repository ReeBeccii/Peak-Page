// backend/src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import { dbGet, dbRun } from "../db/db.js";

const router = Router();

// ==================================================
// AUTH ROUTES
// Zuständig für Registrierung, Login, Session-Info und Logout
// ==================================================

/**
 * POST /api/auth/register
 * Erwartet Body: { username, password }
 *
 * Legt einen neuen Benutzer an und logged ihn direkt ein (Session wird gesetzt).
 */
router.post("/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    // --------------------------------------------------
    // Validierung: Pflichtfelder + Mindestlängen
    // --------------------------------------------------

    if (!username || !password) {
      return res.status(400).json({ error: "Username und Passwort erforderlich." });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: "Username muss mindestens 3 Zeichen haben." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen haben." });
    }

    // --------------------------------------------------
    // Prüfen, ob Username bereits existiert
    // --------------------------------------------------

    const existing = await dbGet("SELECT id FROM users WHERE username = ?", [username]);
    if (existing) {
      return res.status(409).json({ error: "Username existiert bereits." });
    }

    // --------------------------------------------------
    // Passwort hashen + Benutzer speichern
    // --------------------------------------------------

    const password_hash = bcrypt.hashSync(password, 12);

    const result = await dbRun(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, password_hash]
    );

    // --------------------------------------------------
    // Direkt einloggen (Session setzen)
    // --------------------------------------------------

    req.session.user = { id: result.lastID, username };

    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/auth/login
 * Erwartet Body: { username, password }
 *
 * Prüft Benutzername/Passwort und setzt bei Erfolg die Session.
 */
router.post("/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    // --------------------------------------------------
    // Validierung: Pflichtfelder
    // --------------------------------------------------

    if (!username || !password) {
      return res.status(400).json({ error: "Username und Passwort erforderlich." });
    }

    // --------------------------------------------------
    // Benutzer laden + Passwort prüfen
    // --------------------------------------------------

    const user = await dbGet(
      "SELECT id, username, password_hash FROM users WHERE username = ?",
      [username]
    );

    // Absichtlich generische Fehlermeldung (Sicherheit: keine Hinweise geben)
    if (!user) return res.status(401).json({ error: "Login fehlgeschlagen." });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Login fehlgeschlagen." });

    // --------------------------------------------------
    // Session setzen
    // --------------------------------------------------

    req.session.user = { id: user.id, username: user.username };

    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    return next(err);
  }
});

// ==================================================
// SESSION-INFO
// Zuständig für "Wer bin ich?" (aktueller eingeloggter Benutzer)
// ==================================================

/**
 * GET /api/auth/me
 * Gibt den aktuell eingeloggten Benutzer aus der Session zurück.
 */
router.get("/me", (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Nicht eingeloggt." });
  res.json({ user: req.session.user });
});

// ==================================================
// LOGOUT
// Zuständig für das Beenden der Session + Cookie löschen
// ==================================================

/**
 * POST /api/auth/logout
 * Beendet die Session und löscht das Session-Cookie.
 *
 * Hinweis:
 * - Diese Route ist in dieser Datei doppelt definiert (siehe weiter unten).
 * - Code bleibt absichtlich unverändert, da hier nur Kommentare angepasst werden.
 */
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

/**
 * POST /api/auth/logout
 * Alternative Logout-Variante mit Fehlerbehandlung beim Session-Destroy.
 *
 * Hinweis:
 * - Diese Route ist ebenfalls /logout und wird nach der ersten Definition registriert.
 * - Code bleibt absichtlich unverändert, da hier nur Kommentare angepasst werden.
 */
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout fehlgeschlagen." });
    }

    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

export default router;