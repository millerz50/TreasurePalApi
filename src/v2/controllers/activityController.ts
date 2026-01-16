import { Request, Response } from "express";
import {
  fetchActivityForUser,
  fetchRecentActivity,
} from "../services/activityService";

/**
 * GET /api/activity/recent
 * Query params:
 *  - scope: "all" | "user" | "public"
 *
 * Auth:
 *  - scope=all   → admin
 *  - scope=user  → authenticated user
 */
export async function getRecentActivityController(req: Request, res: Response) {
  try {
    const scope = (req.query.scope as string) || "public";
    const accountId = (req.user as any)?.userId;

    let activities = [];

    switch (scope) {
      case "all":
        // 🔐 admin enforced by middleware
        activities = await fetchRecentActivity(50);
        break;

      case "user":
        if (!accountId) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        activities = await fetchActivityForUser(accountId, 50);
        break;

      default:
        activities = await fetchRecentActivity(20);
    }

    // ✅ RETURN ARRAY (frontend expects Activity[])
    return res.json(activities);
  } catch (err: any) {
    console.error("getRecentActivityController error:", err?.stack ?? err);
    return res.status(500).json({ error: "Failed to fetch recent activity" });
  }
}
