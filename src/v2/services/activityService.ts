import { ID, Query, TablesDB } from "node-appwrite";
// activityService.ts
import { getClient, getEnv } from "./lib/env";
import { safeFormatActivity } from "./services/activity/activity.mapper";
import { Activity, ActivityAction } from "./services/activity/activity.types";

const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const ACTIVITY_TABLE = getEnv("APPWRITE_ACTIVITY_TABLE_ID") || "activity";

function db(): TablesDB {
  return new TablesDB(getClient());
}

/* ======================================================
   CREATE ACTIVITY
====================================================== */
export async function logActivity(params: {
  actorId: string; // Appwrite accountId
  actorRole: "user" | "agent" | "admin";
  action: ActivityAction;
  message: string;
  amount?: number;
  refId?: string;
  refType?: string;
}) {
  return db().createRow(DB_ID, ACTIVITY_TABLE, ID.unique(), {
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    message: params.message,
    amount: params.amount ?? null,
    refId: params.refId ?? null,
    refType: params.refType ?? null,
    createdAt: new Date().toISOString(), // ✅ single source of truth
  });
}

/* ======================================================
   FETCH RECENT ACTIVITY (ADMIN / PUBLIC)
====================================================== */
export async function fetchRecentActivity(limit = 20): Promise<Activity[]> {
  const res = await db().listRows(DB_ID, ACTIVITY_TABLE, [
    Query.orderDesc("createdAt"),
    Query.limit(limit),
  ]);

  return res.rows.map(safeFormatActivity);
}

/* ======================================================
   FETCH ACTIVITY FOR USER (ACCOUNT ID)
====================================================== */
export async function fetchActivityForUser(
  accountId: string,
  limit = 20
): Promise<Activity[]> {
  const res = await db().listRows(DB_ID, ACTIVITY_TABLE, [
    Query.equal("actorId", accountId),
    Query.orderDesc("createdAt"),
    Query.limit(limit),
  ]);

  return res.rows.map(safeFormatActivity);
}

/* ======================================================
   FETCH ACTIVITY BY ROLE (OPTIONAL FILTER)
====================================================== */
export async function fetchActivityByRole(
  role: "user" | "agent" | "admin",
  accountId?: string,
  limit = 20
): Promise<Activity[]> {
  const queries: any[] = [
    Query.equal("actorRole", role),
    Query.orderDesc("createdAt"),
    Query.limit(limit),
  ];

  if (accountId) {
    queries.push(Query.equal("actorId", accountId));
  }

  const res = await db().listRows(DB_ID, ACTIVITY_TABLE, queries);
  return res.rows.map(safeFormatActivity);
}
