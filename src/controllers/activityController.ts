// controllers/activityController.ts
import { Request, Response } from "express";
import {
  fetchActivityByRole,
  fetchActivityForUser,
  fetchRecentActivity,
} from "../services/activityService";

/**
 * GET /api/activity/recent
 * Query params:
 *  - scope: "all" | "agent" | "user" | "public" (default: public)
 *  - agentId, userId (when scope is agent/user)
 */
export async function getRecentActivityController(req: Request, res: Response) {
  try {
    const scope = (req.query.scope as string) || "public";

    let activities;
    if (scope === "all") {
      // admin-level: return everything (authMiddleware should ensure admin)
      activities = await fetchRecentActivity(50);
    } else if (scope === "agent") {
      const agentId =
        (req.query.agentId as string) || (req.user as any)?.userId;
      if (!agentId) return res.status(400).json({ error: "agentId required" });
      // use fetchActivityByRole for agent scope
      activities = await fetchActivityByRole("agent", 50);
    } else if (scope === "user") {
      const userId = (req.query.userId as string) || (req.user as any)?.userId;
      if (!userId) return res.status(400).json({ error: "userId required" });
      activities = await fetchActivityForUser(userId, 50);
    } else {
      // public (if you want to filter by a "publicOnly" flag, add that in service)
      activities = await fetchRecentActivity(20);
    }

    return res.json({ ok: true, scope, count: activities.length, activities });
  } catch (err: any) {
    console.error("getRecentActivityController error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to fetch recent activity" });
  }
}
