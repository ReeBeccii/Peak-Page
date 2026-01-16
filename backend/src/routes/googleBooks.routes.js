// src/routes/googleBooks.routes.js
import { Router } from "express";
import { getByIsbn } from "../controllers/googleBooks.controller.js";

const router = Router();

// GET /api/google-books?isbn=...
router.get("/", getByIsbn);

export default router;
