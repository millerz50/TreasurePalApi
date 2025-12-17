// services/activity/activityService.ts
import { ID, Query, TablesDB } from "node-appwrite";
// activityService.ts
import { getClient, getEnv } from "./lib/env";
import { safeFormatActivity } from "./services/activity/activity.mapper";
import { Activity, ActivityAction } from "./services/activity/activity.types";

const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const ACTIVITY_TABLE = getEnv("APPWRITE_ACTIVITY_TABLE_ID") || "activity";

function getTablesDB(): TablesDB {
  return new TablesDB(getClient());
}

/* ======================================================
   CREATE ACTIVITY
====================================================== */
export async function logActivity(params: {
  actorId: string;
  actorRole: "user" | "agent" | "admin";
  action: ActivityAction;
  message: string;
  amount?: number;
  refId?: string;
  refType?: string;
}) {
  return getTablesDB().createRow(DB_ID, ACTIVITY_TABLE, ID.unique(), {
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    message: params.message,
    amount: params.amount ?? null,
    refId: params.refId ?? null,
    refType: params.refType ?? null,
    createdAt: new Date().toISOString(),
  });
}

/* ======================================================
   FETCH RECENT ACTIVITY
====================================================== */
export async function fetchRecentActivity(limit = 20): Promise<Activity[]> {
  const res = await getTablesDB().listRows(DB_ID, ACTIVITY_TABLE, [
    Query.orderDesc("createdAt"),
    Query.limit(limit),
  ]);

  return res.rows.map(safeFormatActivity);
}

/* ======================================================
   FETCH ACTIVITY BY USER
====================================================== */
export async function fetchActivityForUser(
  userId: string,
  limit = 20
): Promise<Activity[]> {
  const res = await getTablesDB().listRows(DB_ID, ACTIVITY_TABLE, [
    Query.equal("actorId", userId),
    Query.orderDesc("createdAt"),
    Query.limit(limit),
  ]);

  return res.rows.map(safeFormatActivity);
}

/* ======================================================
   FETCH ACTIVITY BY ROLE
====================================================== */
export async function fetchActivityByRole(
  role: "user" | "agent" | "admin",
  limit = 20
): Promise<Activity[]> {
  const res = await getTablesDB().listRows(DB_ID, ACTIVITY_TABLE, [
    Query.equal("actorRole", role),
    Query.orderDesc("createdAt"),
    Query.limit(limit),
  ]);

  return res.rows.map(safeFormatActivity);
}
