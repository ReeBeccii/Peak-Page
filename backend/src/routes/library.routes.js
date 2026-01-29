// backend/src/routes/library.routes.js
import { Router } from "express";
import {
  listLibrary,
  updateUserBook,
  deleteUserBook,
} from "../controllers/library.controller.js";

const router = Router();

// ==================================================
// LIBRARY ROUTES
// Zuständig für API-Endpunkte rund um die Benutzer-Bibliothek
// ==================================================

/**
 * GET /api/library?status=finished
 * Liefert die Bibliothek des eingeloggten Benutzers.
 *
 * Hinweis:
 * - status kann z. B. "finished" oder "unread" sein
 */
router.get("/", listLibrary);

/**
 * PATCH /api/library/:userBookId
 * Bearbeitet einen bestehenden user_books Eintrag.
 */
router.patch("/:userBookId", updateUserBook);

/**
 * DELETE /api/library/:userBookId
 * Löscht einen user_books Eintrag.
 *
 * Wichtig:
 * - Es wird NUR der user_books Eintrag gelöscht
 * - Das Buch selbst bleibt in der books-Tabelle bestehen
 */
router.delete("/:userBookId", deleteUserBook);

export default router;