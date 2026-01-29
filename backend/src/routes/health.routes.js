// backend/src/routes/health.routes.js
import { Router } from "express";

const router = Router();

// ==================================================
// HEALTHCHECK
// Zuständig für einfache System- und Erreichbarkeitsprüfungen
// ==================================================

/**
 * GET /api/health
 * Liefert einen einfachen Status-Check der API.
 *
 * Typische Verwendung:
 * - Monitoring / Uptime-Checks
 * - Docker / Kubernetes Healthchecks
 * - Schneller Test, ob der Server erreichbar ist
 */
router.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

export default router;