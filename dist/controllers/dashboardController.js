"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentMetricsController = getAgentMetricsController;
exports.recordAgentMetricsController = recordAgentMetricsController;
const dashboardService_1 = require("../services/dashboard/dashboardService");
/**
 * GET /api/dashboard/agent/:id
 * Returns computed dashboard metrics for the given agentId.
 */
async function getAgentMetricsController(req, res) {
    const agentId = req.params.id;
    try {
        if (!agentId)
            return res.status(400).json({ error: "agentId required" });
        // Optionally enrich with profile data if available
        const profile = await (0, dashboardService_1.getUserProfileByAccountId)(agentId).catch(() => null);
        const metrics = await (0, dashboardService_1.getAgentDashboardMetrics)(agentId);
        return res.json({
            ok: true,
            agentId,
            profile: profile ? { id: profile.$id ?? profile.id, ...profile } : null,
            metrics,
        });
    }
    catch (err) {
        console.error("getAgentMetricsController error:", err?.message ?? err);
        return res.status(500).json({ error: "Failed to fetch agent metrics" });
    }
}
/**
 * POST /api/dashboard/agent/:id/record
 * Accepts an optional metrics payload in the body; if none provided, computes metrics then persists.
 */
async function recordAgentMetricsController(req, res) {
    const agentId = req.params.id;
    try {
        if (!agentId)
            return res.status(400).json({ error: "agentId required" });
        // If client provided metrics, use them; otherwise compute fresh metrics
        const incomingMetrics = req.body?.metrics ?? null;
        const metricsToSave = incomingMetrics ?? (await (0, dashboardService_1.getAgentDashboardMetrics)(agentId));
        const saved = await (0, dashboardService_1.recordAgentMetrics)(agentId, metricsToSave);
        return res.status(201).json({ ok: true, saved });
    }
    catch (err) {
        console.error("recordAgentMetricsController error:", err?.message ?? err);
        return res.status(500).json({ error: "Failed to record agent metrics" });
    }
}
