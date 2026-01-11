"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentDashboardMetrics = getAgentDashboardMetrics;
exports.recordAgentMetrics = recordAgentMetrics;
exports.getUserProfileByAccountId = getUserProfileByAccountId;
exports.buildAvatarUrl = buildAvatarUrl;
// server/services/dashboardService.ts
const node_appwrite_1 = require("node-appwrite");
const APPWRITE_ENDPOINT = (process.env.APPWRITE_ENDPOINT || "").trim();
const APPWRITE_PROJECT_ID = (process.env.APPWRITE_PROJECT_ID || "").trim();
const APPWRITE_API_KEY = (process.env.APPWRITE_API_KEY || "").trim();
const DB_ID = (process.env.APPWRITE_DATABASE_ID || "treasuredataid").trim();
const PROPERTIES_COLLECTION = (process.env.APPWRITE_PROPERTIES_COLLECTION_ID || "properties").trim();
const METRICS_COLLECTION = (process.env.APPWRITE_METRICS_COLLECTION_ID || "agentMetricRecords").trim();
const USER_TABLE_ID = (process.env.APPWRITE_USERTABLE_ID || "userid").trim();
const BUCKET_ID = (process.env.APPWRITE_BUCKET_ID || "userAvatars").trim();
if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.warn("Appwrite configuration incomplete. Ensure APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY are set.");
}
const client = new node_appwrite_1.Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);
/**
 * Build a full URL object for Appwrite Tables endpoints.
 * Ensures we don't duplicate or drop the /v1 segment.
 */
function buildTablesUrl(path) {
    // Normalize base endpoint (remove trailing slash)
    const base = APPWRITE_ENDPOINT.replace(/\/$/, "");
    // If endpoint already contains /v1, don't add it again
    const hasV1 = /\/v1(\/|$)/.test(base);
    const full = hasV1 ? `${base}${path}` : `${base}/v1${path}`;
    return new URL(full);
}
/**
 * List documents from Appwrite Tables collection via REST Tables endpoint.
 * Normalizes response to { total, documents }.
 */
async function fetchDocumentsTables(databaseId, collectionId) {
    try {
        const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`;
        const url = buildTablesUrl(path);
        // client.call expects a URL object for the path parameter (per SDK types)
        const res = await client.call("get", url, {});
        const documents = Array.isArray(res.documents) ? res.documents : [];
        const total = typeof res.total === "number" ? res.total : documents.length;
        return { total, documents };
    }
    catch (err) {
        console.error(`fetchDocumentsTables error for ${collectionId}:`, err?.message ?? err);
        return { total: 0, documents: [] };
    }
}
/**
 * Create a document in a Tables collection via REST Tables endpoint.
 * Uses the Tables payload shape { documentId, data }.
 */
async function createDocumentTables(databaseId, collectionId, documentId, data) {
    try {
        const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`;
        const url = buildTablesUrl(path);
        const payload = { documentId, data };
        // POST body is the payload; headers left empty (SDK handles auth)
        const res = await client.call("post", url, {}, payload);
        return res;
    }
    catch (err) {
        console.error(`createDocumentTables error for ${collectionId}:`, err?.message ?? err);
        throw err;
    }
}
/**
 * Compute metrics for an agent using Tables only.
 * Fetches properties and metrics via Tables endpoints and filters client-side.
 */
async function getAgentDashboardMetrics(agentId) {
    if (!agentId)
        throw new Error("agentId is required");
    try {
        const propsRes = await fetchDocumentsTables(DB_ID, PROPERTIES_COLLECTION);
        const props = propsRes.documents.filter((d) => String(d.agentId) === String(agentId));
        const metricsRes = await fetchDocumentsTables(DB_ID, METRICS_COLLECTION);
        const metricsDocs = metricsRes.documents.filter((d) => String(d.agentId) === String(agentId));
        const propertiesCount = props.length;
        const historicalMetricRecords = metricsDocs.length;
        let avgRating = null;
        const ratings = props
            .map((d) => {
            const r = Number(d.rating);
            return Number.isFinite(r) ? r : null;
        })
            .filter((r) => r !== null);
        if (ratings.length > 0) {
            avgRating =
                Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
                    10;
        }
        return {
            agentId,
            propertiesCount,
            historicalMetricRecords,
            averagePropertyRating: avgRating,
            lastComputedAt: new Date().toISOString(),
        };
    }
    catch (err) {
        console.error("getAgentDashboardMetrics error:", err?.message ?? err);
        throw new Error(`Failed to compute metrics: ${err?.message ?? String(err)}`);
    }
}
/**
 * Persist computed metrics for auditing using Tables create document endpoint.
 */
async function recordAgentMetrics(agentId, metrics) {
    if (!agentId)
        throw new Error("agentId is required");
    if (!metrics)
        throw new Error("metrics payload is required");
    try {
        const payload = {
            agentId,
            metrics,
            recordedAt: new Date().toISOString(),
            source: "dashboardService",
        };
        const doc = await createDocumentTables(DB_ID, METRICS_COLLECTION, node_appwrite_1.ID.unique(), payload);
        return doc;
    }
    catch (err) {
        console.error("recordAgentMetrics error:", err?.message ?? err);
        throw new Error(`Failed to persist metrics: ${err?.message ?? String(err)}`);
    }
}
/**
 * Fetch user profile by accountId from the user table (Tables only).
 */
async function getUserProfileByAccountId(accountId) {
    if (!accountId)
        throw new Error("accountId is required");
    try {
        const res = await fetchDocumentsTables(DB_ID, USER_TABLE_ID);
        const found = res.documents.find((d) => String(d.accountId) === String(accountId));
        return found ?? null;
    }
    catch (err) {
        console.error("getUserProfileByAccountId error:", err?.message ?? err);
        return null;
    }
}
/**
 * Build avatar URL for a stored file id (Appwrite storage).
 */
function buildAvatarUrl(fileId) {
    if (!fileId || !APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !BUCKET_ID) {
        return null;
    }
    const base = APPWRITE_ENDPOINT.replace(/\/v1\/?$/, "");
    return `${base}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}
exports.default = {
    getAgentDashboardMetrics,
    recordAgentMetrics,
    getUserProfileByAccountId,
    buildAvatarUrl,
};
