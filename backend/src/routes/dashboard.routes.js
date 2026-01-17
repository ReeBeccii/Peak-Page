import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/", asyncHandler(getDashboard));
export default router;
