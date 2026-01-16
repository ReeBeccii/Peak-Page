import { Router } from "express";
import bcrypt from "bcryptjs";
import { dbGet, dbRun } from "../db/db.js";

const router = Router();

/**
 * POST /api/auth/register
 * Body: { username, password }
 */
router.post("/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username und Passwort erforderlich." });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: "Username muss mindestens 3 Zeichen haben." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen haben." });
    }

    const existing = await dbGet("SELECT id FROM users WHERE username = ?", [username]);
    if (existing) {
      return res.status(409).json({ error: "Username existiert bereits." });
    }

    const password_hash = bcrypt.hashSync(password, 12);

    const result = await dbRun(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, password_hash]
    );

    // direkt einloggen (Session)
    req.session.user = { id: result.lastID, username };

    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post("/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username und Passwort erforderlich." });
    }

    const user = await dbGet(
      "SELECT id, username, password_hash FROM users WHERE username = ?",
      [username]
    );

    // absichtlich generisch
    if (!user) return res.status(401).json({ error: "Login fehlgeschlagen." });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Login fehlgeschlagen." });

    req.session.user = { id: user.id, username: user.username };

    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    return next(err);
  }
});

router.get("/me", (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Nicht eingeloggt." });
  res.json({ user: req.session.user });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// LOGOUT
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
