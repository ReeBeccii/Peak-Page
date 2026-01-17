// backend/src/routes/library.routes.js
import { Router } from "express";
import {
  listLibrary,
  updateUserBook,
  deleteUserBook,
} from "../controllers/library.controller.js";

const router = Router();

// Liste (z.B. /api/library?status=finished)
router.get("/", listLibrary);

// Bearbeiten eines user_books Eintrags
router.patch("/:userBookId", updateUserBook);

// Löschen eines user_books Eintrags (nur user_books, nicht books!)
router.delete("/:userBookId", deleteUserBook);

export default router;
