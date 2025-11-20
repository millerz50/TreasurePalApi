// server/services/userService.ts
import { Client, ID, Query, TablesDB } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const tablesDB = new TablesDB(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const USERS_TABLE = process.env.APPWRITE_USERTABLE_ID || "user";
const DEBUG = process.env.DEBUG === "true";

if (!DB_ID || !USERS_TABLE) {
  throw new Error(
    `❌ Missing Appwrite config: DB_ID=${DB_ID}, USERS_TABLE=${USERS_TABLE}`
  );
}

type UserRow = any;

function safeFormat(row: any) {
  if (!row) return null;
  const formatted = { ...row };
  delete formatted.password; // never expose password
  return formatted;
}

function logError(operation: string, err: any, context: any = {}) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "userService",
      operation,
      context,
      error: err?.message ?? err,
      stack: err?.stack ?? null,
    })
  );
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  try {
    const row = await tablesDB.getRow(DB_ID, USERS_TABLE, userId);
    return safeFormat(row);
  } catch (err) {
    logError("getUserById", err, { userId });
    return null;
  }
}

export async function getUserByAccountId(
  accountid: string
): Promise<UserRow | null> {
  try {
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
      Query.equal("accountid", accountid),
    ]);
    return res.total > 0 ? safeFormat(res.rows[0]) : null;
  } catch (err) {
    logError("getUserByAccountId", err, { accountid });
    return null;
  }
}

export async function listUsers(limit = 100, offset = 0) {
  try {
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [], String(limit));
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const sliced =
      offset && offset > 0
        ? rows.slice(offset, offset + Number(limit))
        : rows.slice(0, Number(limit));

    return {
      total: res.total ?? sliced.length,
      users: sliced.map(safeFormat),
    };
  } catch (err) {
    logError("listUsers", err, { limit, offset });
    return { total: 0, users: [] };
  }
}

export async function createUser(payload: Record<string, any>) {
  try {
    const id = ID.unique();

    // Normalize accountId → accountid
    if (payload.accountId && !payload.accountid) {
      payload.accountid = payload.accountId;
      delete payload.accountId;
    }

    // Ensure required attributes
    if (!payload.accountid)
      throw new Error("❌ Missing required attribute: accountid");
    if (!payload.email) throw new Error("❌ Missing required attribute: email");
    if (!payload.firstName)
      throw new Error("❌ Missing required attribute: firstName");
    if (!payload.surname)
      throw new Error("❌ Missing required attribute: surname");
    if (!payload.password)
      throw new Error("❌ Missing required attribute: password");

    const row = await tablesDB.createRow(DB_ID, USERS_TABLE, id, payload);

    if (DEBUG) console.log("createUser payload:", payload, "row:", row);
    return safeFormat(row);
  } catch (err) {
    logError("createUser", err, { payload });
    throw err;
  }
}

export async function updateUser(userId: string, updates: Record<string, any>) {
  try {
    if ("password" in updates) delete updates.password;
    const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, updates);
    return safeFormat(row);
  } catch (err) {
    logError("updateUser", err, { userId, updates });
    throw err;
  }
}

export async function deleteUser(userId: string) {
  try {
    return await tablesDB.deleteRow(DB_ID, USERS_TABLE, userId);
  } catch (err) {
    logError("deleteUser", err, { userId });
    throw err;
  }
}

export async function setRole(userId: string, role: string) {
  try {
    const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, { role });
    return safeFormat(row);
  } catch (err) {
    logError("setRole", err, { userId, role });
    throw err;
  }
}

export async function setStatus(userId: string, status: string) {
  try {
    const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, {
      status,
    });
    return safeFormat(row);
  } catch (err) {
    logError("setStatus", err, { userId, status });
    throw err;
  }
}

export async function findByEmail(email: string) {
  try {
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
      Query.equal("email", email.toLowerCase()),
    ]);
    return res.total > 0 ? safeFormat(res.rows[0]) : null;
  } catch (err) {
    logError("findByEmail", err, { email });
    return null;
  }
}
