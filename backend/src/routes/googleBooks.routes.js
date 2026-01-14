// backend/src/routes/googleBooks.routes.js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { searchGoogleBooks, getGoogleBookById } from "../controllers/googleBooks.controller.js";

const router = Router();

router.get("/search", asyncHandler(searchGoogleBooks));
router.get("/volumes/:id", asyncHandler(getGoogleBookById));

export default router;
