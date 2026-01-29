// backend/src/routes/googleBooks.routes.js
import { Router } from "express";
import { getByIsbn } from "../controllers/googleBooks.controller.js";

const router = Router();

// ==================================================
// GOOGLE BOOKS ROUTES
// Zuständig für die ISBN-Suche (lokal + Google Books API)
// ==================================================

/**
 * GET /api/google-books?isbn=...
 * Sucht ein Buch anhand der ISBN.
 *
 * Ablauf:
 * - Zuerst lokale Datenbank prüfen
 * - Falls nicht vorhanden: Google Books API abfragen
 */
router.get("/", getByIsbn);

export default router;