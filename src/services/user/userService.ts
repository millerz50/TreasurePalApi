import { ID, Permission, Query, Role, TablesDB } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";
import { UserRow, safeFormat } from "../../services/lib/models/user";

import { findByEmail, getUserByAccountId, getUserById } from "./gettersService";

const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";

function getTablesDB(): TablesDB {
  return new TablesDB(getClient());
}

/* ============================
   DB helpers
============================ */

export async function createUserRow(payload: Record<string, any>) {
  return getTablesDB().createRow(DB_ID, USERS_TABLE, ID.unique(), payload, [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any()),
  ]);
}

/** Alias expected by controllers */
export const createUser = createUserRow;

export async function updateUser(userId: string, updates: Partial<UserRow>) {
  return getTablesDB().updateRow(DB_ID, USERS_TABLE, userId, updates);
}

export async function deleteUser(userId: string) {
  return getTablesDB().deleteRow(DB_ID, USERS_TABLE, userId);
}

/* ============================
   Admin helpers
============================ */

export async function setRole(userId: string, role: string) {
  return updateUser(userId, { role });
}

export async function setStatus(userId: string, status: UserRow["status"]) {
  return updateUser(userId, { status });
}

/* ============================
   Queries
============================ */

export async function listAgents() {
  const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
    Query.equal("role", "agent"),
  ]);
  return res.rows.map(safeFormat);
}

export async function listUsers(limit = 100) {
  const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
    Query.limit(limit),
  ]);
  return res.rows.map(safeFormat);
}

/* ============================
   Re-exports (IMPORTANT)
============================ */

export { findByEmail, getUserByAccountId, getUserById };
