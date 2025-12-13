import { ID, Permission, Query, Role, TablesDB } from "node-appwrite"; // ✅ add Query
import { getClient, getEnv } from "../../services/lib/env";
import { UserRow, safeFormat } from "../../services/lib/models/user"; // ✅ add safeFormat
import { findByEmail, getUserByAccountId, getUserById } from "./gettersService";
import { SigninPayload, signinUser } from "./signinService";
import { SignupPayload, signupUser } from "./signupService";

const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";

function getTablesDB(): TablesDB {
  return new TablesDB(getClient());
}

/* Low-level helper to create a user row in DB */
export async function createUserRow(payload: Record<string, any>) {
  const tablesDB = getTablesDB();
  return tablesDB.createRow(DB_ID, USERS_TABLE, ID.unique(), payload, [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any()),
  ]);
}

/* High-level createUser for adminService */
export async function createUser(payload: Record<string, any>) {
  return createUserRow(payload);
}

/* Update user row */
export async function updateUser(userId: string, updates: Partial<UserRow>) {
  const tablesDB = getTablesDB();
  return tablesDB.updateRow(DB_ID, USERS_TABLE, userId, updates);
}

export class UserService {
  async signup(payload: SignupPayload) {
    return signupUser(payload);
  }

  async signin(payload: SigninPayload) {
    return signinUser(payload);
  }

  async getById(id: string): Promise<UserRow | null> {
    return getUserById(id);
  }

  async getByAccountId(accountId: string): Promise<UserRow | null> {
    return getUserByAccountId(accountId);
  }

  async getByEmail(email: string): Promise<UserRow | null> {
    return findByEmail(email);
  }
}

/* Delete user row */
export async function deleteUser(userId: string) {
  const tablesDB = getTablesDB();
  return tablesDB.deleteRow(DB_ID, USERS_TABLE, userId);
}

/* List all agents */
export async function listAgents() {
  const tablesDB = getTablesDB();
  const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
    Query.equal("role", "agent"),
  ]);
  return res.rows.map(safeFormat);
}

export async function listUsers(limit: number = 100) {
  const tablesDB = getTablesDB();
  const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
    Query.limit(limit), // ✅ pass limit as a query
  ]);
  return res.rows.map(safeFormat);
}

/* Set user role */
export async function setRole(userId: string, role: string) {
  const tablesDB = getTablesDB();
  return tablesDB.updateRow(DB_ID, USERS_TABLE, userId, { role });
}

/* Set user status */
export async function setStatus(userId: string, status: string) {
  const tablesDB = getTablesDB();
  return tablesDB.updateRow(DB_ID, USERS_TABLE, userId, { status });
}

export const userService = new UserService();

// re‑export types
export type { UserRow } from "../../services/lib/models/user";
export type { SigninPayload } from "./signinService";
export type { SignupPayload } from "./signupService";

// re‑export functions
export { findByEmail, getUserByAccountId, getUserById } from "./gettersService";
export { signinUser } from "./signinService";
export { signupUser } from "./signupService";
