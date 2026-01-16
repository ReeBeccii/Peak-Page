// src/routes/books.routes.js
import { Router } from "express";
import { listMyBooks, getBookById } from "../controllers/books.controller.js";
import { createBook } from "../controllers/books.create.controller.js";

const router = Router();

router.get("/", listMyBooks);
router.get("/:id", getBookById);
router.post("/", createBook);

export default router;
