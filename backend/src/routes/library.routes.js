// src/routes/library.routes.js
import { Router } from "express";
import {
  listLibraryBooks,
  getLibraryFilters,
} from "../controllers/library.controller.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: "Nicht eingeloggt." });
  }
  next();
}

// Bücher (Bibliothek / SuB) laden
router.get("/", requireAuth, listLibraryBooks);

// Dropdown-Daten (Jahre/Autor:innen/Formate)
router.get("/filters", requireAuth, getLibraryFilters);

export default router;
