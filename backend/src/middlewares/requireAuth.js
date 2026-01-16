// src/middlewares/requireAuth.js
export function requireAuth(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: "Nicht eingeloggt." });
  }
  next();
}
