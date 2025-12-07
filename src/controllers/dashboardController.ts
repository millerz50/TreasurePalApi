import { Request, Response } from "express";
import {
  getAgentDashboardMetrics,
  getUserProfileByAccountId,
  recordAgentMetrics,
} from "../services/dashboard/dashboardService";

/**
 * GET /api/dashboard/agent/:id
 * Returns computed dashboard metrics for the given agentId.
 */
export async function getAgentMetricsController(req: Request, res: Response) {
  const agentId = req.params.id;
  try {
    if (!agentId) return res.status(400).json({ error: "agentId required" });

    // Optionally enrich with profile data if available
    const profile = await getUserProfileByAccountId(agentId).catch(() => null);

    const metrics = await getAgentDashboardMetrics(agentId);

    return res.json({
      ok: true,
      agentId,
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
  res: Response
) {
  const agentId = req.params.id;
  try {
    if (!agentId) return res.status(400).json({ error: "agentId required" });

    // If client provided metrics, use them; otherwise compute fresh metrics
    const incomingMetrics = req.body?.metrics ?? null;
    const metricsToSave =
      incomingMetrics ?? (await getAgentDashboardMetrics(agentId));

    const saved = await recordAgentMetrics(agentId, metricsToSave);

    return res.status(201).json({ ok: true, saved });
  } catch (err: any) {
    console.error("recordAgentMetricsController error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to record agent metrics" });
  }
}
