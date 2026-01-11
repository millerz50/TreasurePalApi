"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetricsHandler = getMetricsHandler;
const dashboardService_1 = require("../services/dashboard/dashboardService");
/**
 * GET /metrics
 * Expects verifyToken middleware to populate req.agent or req.user
 */
async function getMetricsHandler(req, res, next) {
    try {
        const agentPayload = req.agent ?? req.user;
        if (!agentPayload || (!agentPayload.id && !agentPayload.$id)) {
            return res.status(401).json({ error: "Invalid token payload" });
        }
        const agentId = agentPayload.id ?? agentPayload.$id;
        // Verify agent existence is the responsibility of service or middleware; do a quick existence check:
        const metrics = await (0, dashboardService_1.getAgentDashboardMetrics)(agentId);
        // Persist audit record (non-blocking persist could be used, but we await here to surface errors)
        await (0, dashboardService_1.recordAgentMetrics)(agentId, metrics);
        return res.status(200).json({ agentId, metrics });
    }
    catch (err) {
        return next(err);
    }
}
