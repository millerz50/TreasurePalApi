"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/activity.ts
const express_1 = require("express");
const activityController_1 = require("../controllers/activityController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Public: recent activity with optional scope query
// Examples:
//  GET /api/activity/recent
//  GET /api/activity/recent?scope=agent&agentId=abc
//  GET /api/activity/recent?scope=user&userId=xyz
//  GET /api/activity/recent?scope=all   (admin)
router.get("/recent", authMiddleware_1.authMiddleware, activityController_1.getRecentActivityController);
exports.default = router;
