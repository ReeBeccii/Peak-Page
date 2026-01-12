import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createUserBook,
  updateUserBook,
  deleteUserBook,
} from "../controllers/userBooks.controller.js";

import { validate } from "../middlewares/validate.js";

const router = Router();

router.post(
  "/",
  validate(["user_id", "book_id"]), // Pflichtfelder
  asyncHandler(createUserBook)
);

router.put(
  "/:id",
  asyncHandler(updateUserBook)
);

router.delete(
  "/:id",
  asyncHandler(deleteUserBook)
);

export default router;
