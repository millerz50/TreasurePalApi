// routes/activity.ts
import { Router } from "express";
import { getRecentActivityController } from "../controllers/activityController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// Public: recent activity with optional scope query
// Examples:
//  GET /api/activity/recent
//  GET /api/activity/recent?scope=agent&agentId=abc
//  GET /api/activity/recent?scope=user&userId=xyz
//  GET /api/activity/recent?scope=all   (admin)
router.get("/recent", authMiddleware, getRecentActivityController);

export default router;
