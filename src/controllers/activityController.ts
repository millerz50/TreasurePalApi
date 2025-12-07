// controllers/activityController.ts
import { Request, Response } from "express";
import {
  fetchRecentActivity,
  fetchRecentActivityForAgent,
  fetchRecentActivityForUser,
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
      activities = await fetchRecentActivity({ limit: 50 });
    } else if (scope === "agent") {
      const agentId =
        (req.query.agentId as string) || (req.user as any)?.userId;
      if (!agentId) return res.status(400).json({ error: "agentId required" });
      activities = await fetchRecentActivityForAgent(agentId, { limit: 50 });
    } else if (scope === "user") {
      const userId = (req.query.userId as string) || (req.user as any)?.userId;
      if (!userId) return res.status(400).json({ error: "userId required" });
      activities = await fetchRecentActivityForUser(userId, { limit: 50 });
    } else {
      // public
      activities = await fetchRecentActivity({ limit: 20, publicOnly: true });
    }

    return res.json({ ok: true, scope, count: activities.length, activities });
  } catch (err: any) {
    console.error("getRecentActivityController error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to fetch recent activity" });
  }
}
