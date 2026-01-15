import { Router } from "express";
import { getRecentActivityController } from "../controllers/activityController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

// Protected recent activity
router.get("/recent", verifyToken, getRecentActivityController);

export default router;
