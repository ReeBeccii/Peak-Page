import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getBooks, getBookById, importBookFromGoogle } from "../controllers/books.controller.js";

const router = Router();

router.get("/", asyncHandler(getBooks));
router.get("/:id", asyncHandler(getBookById));
router.post("/import", asyncHandler(importBookFromGoogle));

export default router;
