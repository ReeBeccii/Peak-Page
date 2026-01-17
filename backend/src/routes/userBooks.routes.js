
// src/routes/userBooks.routes.js
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

// GET /api/user-books?user_id=...
router.get("/", asyncHandler(listUserBooks));

// POST /api/user-books
router.post(
  "/",
  validate(["user_id", "book_id"]),
  asyncHandler(createUserBook)
);

// PUT /api/user-books/:id
router.put("/:id", asyncHandler(updateUserBook));

// ✅ NEU: PATCH /api/user-books/:id (für dein Frontend)
router.patch("/:id", asyncHandler(updateUserBook));

// DELETE /api/user-books/:id
router.delete("/:id", asyncHandler(deleteUserBook));

export default router;
