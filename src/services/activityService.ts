// services/activityService.ts
/**
 * Minimal service layer for recent activity.
 * Replace the mock implementations with real DB queries (Postgres, Mongo, etc.)
 * or calls to your event store.
 */

export type Activity = {
  id: string;
  message: string;
  createdAt: string;
  actorId?: string;
  actorRole?: string;
  meta?: Record<string, any>;
};

type FetchOptions = {
  limit?: number;
  publicOnly?: boolean;
};

const now = () => new Date().toISOString();

/**
 * Mock dataset (for local/dev). Replace with DB queries.
 */
const MOCK_ACTIVITIES: Activity[] = [
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
export async function fetchRecentActivity(
  opts: FetchOptions = {}
): Promise<Activity[]> {
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
export async function fetchRecentActivityForAgent(
  agentId: string,
  opts: FetchOptions = {}
): Promise<Activity[]> {
  const limit = opts.limit ?? 20;
  const items = MOCK_ACTIVITIES.filter(
    (a) => a.actorRole === "agent" && a.actorId === agentId
  )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
  return items;
}

/**
 * Fetch recent activity for a specific user
 */
export async function fetchRecentActivityForUser(
  userId: string,
  opts: FetchOptions = {}
): Promise<Activity[]> {
  const limit = opts.limit ?? 20;
  const items = MOCK_ACTIVITIES.filter(
    (a) => a.actorRole === "user" && a.actorId === userId
  )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
  return items;
}
