// server/controllers/agentController.ts
import { NextFunction, Response } from "express";
import {
  getAgentDashboardMetrics,
  recordAgentMetrics,
} from "../services/dashboard/dashboardService";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";

/**
 * GET /metrics
 * Expects verifyToken middleware to populate req.agent or req.user
 */
export async function getMetricsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const agentPayload = req.agent ?? (req as any).user;
    if (!agentPayload || (!agentPayload.id && !agentPayload.$id)) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const agentId = agentPayload.id ?? agentPayload.$id;
    // Verify agent existence is the responsibility of service or middleware; do a quick existence check:
    const metrics = await getAgentDashboardMetrics(agentId);

    // Persist audit record (non-blocking persist could be used, but we await here to surface errors)
    await recordAgentMetrics(agentId, metrics);

    return res.status(200).json({ agentId, metrics });
  } catch (err: any) {
    return next(err);
  }
}
