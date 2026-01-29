// backend/src/routes/dashboard.routes.js
import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// ==================================================
// DASHBOARD ROUTES
// Zuständig für API-Endpunkte rund um das Benutzer-Dashboard
// ==================================================

/**
 * GET /api/dashboard
 * Liefert aggregierte Kennzahlen für das Dashboard des eingeloggten Benutzers.
 *
 * Hinweis:
 * - Der Controller wird über asyncHandler eingebunden,
 *   damit asynchrone Fehler sauber an Express weitergereicht werden.
 */
router.get("/", asyncHandler(getDashboard));

export default router;