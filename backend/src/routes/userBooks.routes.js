// backend/src/routes/userBooks.routes.js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  listUserBooks,
  createUserBook,
  updateUserBook,
  deleteUserBook,
} from "../controllers/userBooks.controller.js";

import { validate } from "../middlewares/validate.js";

const router = Router();

// ==================================================
// USER-BOOKS ROUTES
// Zuständig für das Benutzer-Regal (user_books)
// ==================================================

/**
 * GET /api/user-books?user_id=...
 * Liefert alle Regal-Einträge eines Benutzers.
 */
router.get("/", asyncHandler(listUserBooks));

/**
 * POST /api/user-books
 * Erstellt einen neuen Regal-Eintrag.
 *
 * Hinweis:
 * - Pflichtfelder werden vorab per validate-Middleware geprüft
 */
router.post(
  "/",
  validate(["user_id", "book_id"]),
  asyncHandler(createUserBook)
);

/**
 * PUT /api/user-books/:id
 * Ersetzt/aktualisiert einen bestehenden Regal-Eintrag vollständig.
 */
router.put("/:id", asyncHandler(updateUserBook));

/**
 * PATCH /api/user-books/:id
 * Aktualisiert einen bestehenden Regal-Eintrag teilweise.
 *
 * Hinweis:
 * - Wird vom Frontend verwendet
 */
router.patch("/:id", asyncHandler(updateUserBook));

/**
 * DELETE /api/user-books/:id
 * Löscht einen Regal-Eintrag.
 */
router.delete("/:id", asyncHandler(deleteUserBook));

export default router;