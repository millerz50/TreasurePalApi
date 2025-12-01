"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentDashboardMetrics = getAgentDashboardMetrics;
exports.recordAgentMetrics = recordAgentMetrics;
// server/services/dashboardService.ts
const node_appwrite_1 = require("node-appwrite");
const client = new node_appwrite_1.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const databases = new node_appwrite_1.Databases(client);
const DB_ID = process.env.APPWRITE_DATABASE_ID || "TreasurePal";
const AGENTS_COLLECTION = process.env.APPWRITE_AGENTS_COLLECTION_ID || "agents";
const METRICS_COLLECTION = process.env.APPWRITE_METRICS_COLLECTION_ID || "agentMetricRecords";
/**
 * Compute metrics for an agent.
 * This is a sample implementation — replace with your real calculations.
 */
async function getAgentDashboardMetrics(agentId) {
    // Example: count properties, count sales records, average rating — replace queries with your collections
    // Safe defaults if collections don't exist or return 0.
    try {
        // Example: count properties created by agent
        const propertiesRes = await databases.listDocuments(DB_ID, process.env.APPWRITE_PROPERTIES_COLLECTION_ID || "properties", [node_appwrite_1.Query.equal("agentId", agentId)]);
        // Example: count metric records for the agent
        const metricsRes = await databases.listDocuments(DB_ID, METRICS_COLLECTION, [node_appwrite_1.Query.equal("agentId", agentId)]);
        // Build minimal metrics object — extend with domain-specific fields
        const metrics = {
            propertiesCount: propertiesRes.total ?? 0,
            historicalMetricRecords: metricsRes.total ?? 0,
            lastComputedAt: new Date().toISOString(),
        };
        return metrics;
    }
    catch (err) {
        // Bubble up with context
        throw new Error(`Failed to compute metrics: ${err?.message ?? String(err)}`);
    }
}
/**
 * Persist computed metrics for auditing.
 */
async function recordAgentMetrics(agentId, metrics) {
    try {
        const doc = await databases.createDocument(DB_ID, METRICS_COLLECTION, node_appwrite_1.ID.unique(), {
            agentId,
            metrics,
            recordedAt: new Date().toISOString(),
        });
        return doc;
    }
    catch (err) {
        throw new Error(`Failed to persist metrics: ${err?.message ?? String(err)}`);
    }
}
