// backend/src/routes/books.routes.js
import { Router } from "express";
import { listMyBooks, getBookById } from "../controllers/books.controller.js";
import { createBook } from "../controllers/books.create.controller.js";

const router = Router();

// ==================================================
// BOOKS ROUTES
// Zuständig für API-Routen rund um Bücher des eingeloggten Benutzers
// ==================================================

/**
 * GET /api/books
 * Liefert alle Bücher des eingeloggten Benutzers.
 */
router.get("/", listMyBooks);

/**
 * GET /api/books/:id
 * Liefert ein einzelnes Buch anhand der ID.
 */
router.get("/:id", getBookById);

/**
 * POST /api/books
 * Legt ein neues Buch an und verknüpft es mit dem eingeloggten Benutzer.
 */
router.post("/", createBook);

export default router;