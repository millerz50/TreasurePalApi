/* lib/users.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, ID, Permission, Query, Role, TablesDB } from "node-appwrite";

/* ------------------------------------------
    ENV + CLIENT
------------------------------------------- */

function getEnv(key: string, fallback?: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

function requireEnv(key: string): string {
  const v = getEnv(key);
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;

  _client = new Client()
    .setEndpoint(requireEnv("APPWRITE_ENDPOINT"))
    .setProject(requireEnv("APPWRITE_PROJECT_ID"))
    .setKey(requireEnv("APPWRITE_API_KEY"));

  return _client;
}

function getTablesDB(): TablesDB {
  return new TablesDB(getClient());
}

/* ------------------------------------------
    CONSTANTS
------------------------------------------- */

const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";
const DEBUG = getEnv("DEBUG") === "true";

if (!DB_ID) console.warn("Warning: APPWRITE_DATABASE_ID missing");

/* ------------------------------------------
    INTERFACES + UTILS
------------------------------------------- */

export interface UserRow {
  $id?: string;
  accountid?: string; // stored column name in DB
  email?: string;
  firstName?: string;
  surname?: string;
  role?: string;
  status?: string;
  nationalId?: string | null;
  metadata?: any[];
  country?: string | null;
  location?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  agentId?: string | null;
  bio?: string | null;
  [key: string]: any;
}

function safeFormat(row: any): UserRow | null {
  if (!row || typeof row !== "object") return null;
  const f: any = { ...(row as Record<string, any>) };
  // remove sensitive fields if present
  if ("password" in f) delete f.password;
  return f as UserRow;
}

function logStep(step: string, data?: any) {
  if (DEBUG) console.log("DEBUG:", step, data ?? "");
}

function logError(operation: string, err: unknown, ctx: any = {}) {
  console.error(
    JSON.stringify({
      time: new Date().toISOString(),
      operation,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      ctx,
    })
  );
}

/* ------------------------------------------
    CORE: signupUser (create profile row)
------------------------------------------- */

export async function signupUser(payload: {
  accountId: string;
  email: string;
  firstName: string;
  surname: string;
  country?: string;
  location?: string;
  role?: string;
  status?: string;
  nationalId?: string;
  bio?: string;
  metadata?: any[];
  dateOfBirth?: string;
  phone?: string | null;
}) {
  logStep("START signupUser", {
    accountId: payload.accountId,
    email: payload.email,
  });

  const tablesDB = getTablesDB();
  const normalizedEmail = payload.email.toLowerCase().trim();

  // Prevent duplicate profiles
  const existing = await findByEmail(normalizedEmail).catch(() => null);
  if (existing) {
    const error = new Error("User already exists with this email.");
    (error as any).status = 409;
    throw error;
  }

  const rowPayload: Record<string, any> = {
    // store as lowercase DB column name `accountid`
    accountid: payload.accountId,
    email: normalizedEmail,
    firstName: payload.firstName,
    surname: payload.surname,
    country: payload.country ?? null,
    location: payload.location ?? null,
    role: payload.role ?? "user",
    status: payload.status ?? "Pending",
    nationalId: payload.nationalId ?? null,
    bio: payload.bio ?? null,
    metadata: Array.isArray(payload.metadata) ? payload.metadata : [],
    dateOfBirth: payload.dateOfBirth ?? null,
    phone: payload.phone ?? null,
    agentId: ID.unique(),
  };

  try {
    const row = await tablesDB.createRow(
      DB_ID,
      USERS_TABLE,
      ID.unique(),
      rowPayload,
      [
        Permission.read(Role.user(payload.accountId)),
        Permission.update(Role.user(payload.accountId)),
        Permission.delete(Role.user(payload.accountId)),
      ]
    );

    return {
      status: "SUCCESS",
      userId: payload.accountId,
      profileId: row.$id,
      profile: safeFormat(row),
    };
  } catch (err) {
    logError("signupUser.createRow", err, {
      payload: { accountId: payload.accountId, email: normalizedEmail },
    });
    throw err;
  }
}

export async function createUser(p: Parameters<typeof signupUser>[0]) {
  return signupUser(p);
}

/* ------------------------------------------
    GETTERS
------------------------------------------- */

export async function getUserById(id: string) {
  try {
    const row = await getTablesDB().getRow(DB_ID, USERS_TABLE, id);
    return safeFormat(row);
  } catch (err) {
    logError("getUserById", err, { id });
    return null;
  }
}

export async function getUserByAccountId(accountid: string) {
  try {
    const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
      Query.equal("accountid", accountid),
    ]);
    return res.total > 0 ? safeFormat(res.rows[0]) : null;
  } catch (err) {
    logError("getUserByAccountId", err, { accountid });
    return null;
  }
}

export async function findByEmail(email: string) {
  try {
    const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
      Query.equal("email", email.toLowerCase()),
    ]);
    return res.total > 0 ? safeFormat(res.rows[0]) : null;
  } catch (err) {
    logError("findByEmail", err, { email });
    return null;
  }
}

/* ------------------------------------------
    LIST
------------------------------------------- */

export async function listUsers(limit = 100, offset = 0) {
  try {
    const res = await getTablesDB().listRows(
      DB_ID,
      USERS_TABLE,
      [],
      String(limit)
    );

    const rows = res.rows ?? [];
    return {
      total: res.total ?? rows.length,
      users: rows.slice(offset, offset + limit).map(safeFormat),
    };
  } catch (err) {
    logError("listUsers", err, { limit, offset });
    return { total: 0, users: [] };
  }
}

/* ------------------------------------------
    UPDATE / DELETE
------------------------------------------- */

export async function updateUser(id: string, updates: Record<string, any>) {
  try {
    if ("password" in updates) delete updates.password;

    const row = await getTablesDB().updateRow(DB_ID, USERS_TABLE, id, updates);

    return safeFormat(row);
  } catch (err) {
    logError("updateUser", err, { id, updates });
    throw err;
  }
}

export async function deleteUser(id: string) {
  try {
    return await getTablesDB().deleteRow(DB_ID, USERS_TABLE, id);
  } catch (err) {
    logError("deleteUser", err, { id });
    throw err;
  }
}

/* ------------------------------------------
    AGENT HELPERS
------------------------------------------- */

export async function setRole(id: string, role: string) {
  try {
    const row = await getTablesDB().updateRow(DB_ID, USERS_TABLE, id, { role });
    return safeFormat(row);
  } catch (err) {
    logError("setRole", err, { id, role });
    throw err;
  }
}

export async function setStatus(id: string, status: string) {
  try {
    const row = await getTablesDB().updateRow(DB_ID, USERS_TABLE, id, {
      status,
    });
    return safeFormat(row);
  } catch (err) {
    logError("setStatus", err, { id, status });
    throw err;
  }
}

export async function listAgents(limit = 100, offset = 0) {
  try {
    const res = await getTablesDB().listRows(
      DB_ID,
      USERS_TABLE,
      [Query.equal("role", "agent")],
      String(limit)
    );

    const rows = res.rows ?? [];

    return {
      total: res.total ?? rows.length,
      agents: rows.slice(offset, offset + limit).map(safeFormat),
    };
  } catch (err) {
    logError("listAgents", err, { limit, offset });
    return { total: 0, agents: [] };
  }
}
