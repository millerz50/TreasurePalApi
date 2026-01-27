import { Request, Response } from "express";
import dashboardService from "../services/dashboard/dashboardService"; // default import

// Destructure methods for convenience
const { getUserProfileByUserId, getAgentDashboardMetrics, recordAgentMetrics } =
  dashboardService;

/**
 * GET /api/dashboard/agent/:id
 * Returns computed dashboard metrics for the given userId ($id).
 */
export async function getAgentMetricsController(req: Request, res: Response) {
  const userId = req.params.id; // treat this as $id

  try {
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    // Enrich with profile data by $id
    const profile = await getUserProfileByUserId(userId).catch(() => null);

    // Compute agent metrics
    const metrics = await getAgentDashboardMetrics(userId);

    return res.json({
      ok: true,
      userId,
      profile: profile ? { id: profile.$id ?? profile.id, ...profile } : null,
      metrics,
    });
  } catch (err: any) {
    console.error("getAgentMetricsController error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to fetch agent metrics" });
  }
}

/**
 * POST /api/dashboard/agent/:id/record
 * Accepts an optional metrics payload in the body; if none provided, computes metrics then persists.
 */
export async function recordAgentMetricsController(
  req: Request,
  res: Response,
) {
  const userId = req.params.id; // treat this as $id

  try {
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    // If metrics provided in body, use them; otherwise compute
    const incomingMetrics = req.body?.metrics ?? null;
    const metricsToSave =
      incomingMetrics ?? (await getAgentDashboardMetrics(userId));

    const saved = await recordAgentMetrics(userId, metricsToSave);

    return res.status(201).json({ ok: true, saved });
  } catch (err: any) {
    console.error("recordAgentMetricsController error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to record agent metrics" });
  }
}
