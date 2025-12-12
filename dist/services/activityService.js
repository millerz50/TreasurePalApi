"use strict";
// services/activityService.ts
/**
 * Minimal service layer for recent activity.
 * Replace the mock implementations with real DB queries (Postgres, Mongo, etc.)
 * or calls to your event store.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRecentActivity = fetchRecentActivity;
exports.fetchRecentActivityForAgent = fetchRecentActivityForAgent;
exports.fetchRecentActivityForUser = fetchRecentActivityForUser;
const now = () => new Date().toISOString();
/**
 * Mock dataset (for local/dev). Replace with DB queries.
 */
const MOCK_ACTIVITIES = [
    {
        id: "a1",
        message: "Property 123 listed",
        createdAt: now(),
        actorId: "692426dd000ad4665c6e",
        actorRole: "agent",
    },
    {
        id: "a2",
        message: "User jane favorited property 123",
        createdAt: now(),
        actorId: "user-1",
        actorRole: "user",
    },
    {
        id: "a3",
        message: "Agent bob invited new agent",
        createdAt: now(),
        actorId: "admin-1",
        actorRole: "admin",
    },
];
/**
 * Fetch recent activity (global)
 */
async function fetchRecentActivity(opts = {}) {
    // Replace with DB: SELECT ... ORDER BY createdAt DESC LIMIT opts.limit
    const limit = opts.limit ?? 20;
    const items = MOCK_ACTIVITIES.slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, limit);
    return items;
}
/**
 * Fetch recent activity for a specific agent
 */
async function fetchRecentActivityForAgent(agentId, opts = {}) {
    const limit = opts.limit ?? 20;
    const items = MOCK_ACTIVITIES.filter((a) => a.actorRole === "agent" && a.actorId === agentId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, limit);
    return items;
}
/**
 * Fetch recent activity for a specific user
 */
async function fetchRecentActivityForUser(userId, opts = {}) {
    const limit = opts.limit ?? 20;
    const items = MOCK_ACTIVITIES.filter((a) => a.actorRole === "user" && a.actorId === userId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, limit);
    return items;
}
