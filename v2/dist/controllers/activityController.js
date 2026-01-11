"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentActivityController = getRecentActivityController;
const activityService_1 = require("../services/activityService");
/**
 * GET /api/activity/recent
 * Query params:
 *  - scope: "all" | "agent" | "user" | "public" (default: public)
 *  - agentId, userId (when scope is agent/user)
 */
async function getRecentActivityController(req, res) {
    try {
        const scope = req.query.scope || "public";
        let activities;
        if (scope === "all") {
            // admin-level: return everything (authMiddleware should ensure admin)
            activities = await (0, activityService_1.fetchRecentActivity)({ limit: 50 });
        }
        else if (scope === "agent") {
            const agentId = req.query.agentId || req.user?.userId;
            if (!agentId)
                return res.status(400).json({ error: "agentId required" });
            activities = await (0, activityService_1.fetchRecentActivityForAgent)(agentId, { limit: 50 });
        }
        else if (scope === "user") {
            const userId = req.query.userId || req.user?.userId;
            if (!userId)
                return res.status(400).json({ error: "userId required" });
            activities = await (0, activityService_1.fetchRecentActivityForUser)(userId, { limit: 50 });
        }
        else {
            // public
            activities = await (0, activityService_1.fetchRecentActivity)({ limit: 20, publicOnly: true });
        }
        return res.json({ ok: true, scope, count: activities.length, activities });
    }
    catch (err) {
        console.error("getRecentActivityController error:", err?.message ?? err);
        return res.status(500).json({ error: "Failed to fetch recent activity" });
    }
}
