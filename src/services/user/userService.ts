/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
const { Client, ID, Query, TablesDB, Users } = require("node-appwrite");

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const tablesDB = new TablesDB(client);
const users = new Users(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const USERS_TABLE = process.env.APPWRITE_USERTABLE_ID || "user";
const DEBUG = process.env.DEBUG === "true";

if (!DB_ID || !USERS_TABLE) {
  throw new Error(
    `❌ Missing Appwrite config: DB_ID=${DB_ID}, USERS_TABLE=${USERS_TABLE}`
  );
}

export interface UserRow {
  $id?: string;
  accountid?: string;
  email?: string;
  firstName?: string;
  surname?: string;
  role?: string;
  status?: string;
  nationalId?: string | null;
  bio?: string | null;
  metadata?: string[];
  country?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

function safeFormat(row: unknown): UserRow | null {
  if (!row || typeof row !== "object") return null;
  const formatted = { ...(row as UserRow) };
  delete (formatted as any).password;
  return formatted;
}

function logError(
  operation: string,
  err: unknown,
  context: Record<string, unknown> = {}
) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "userService",
      operation,
      context,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : null,
    })
  );
}

/**
 * Normalize phone to E.164-ish string or return null.
 */
function normalizePhone(phone?: unknown): string | null {
  if (!phone || typeof phone !== "string") return null;
  const trimmed = phone.trim();
  const cleaned = trimmed.replace(/[\s\-().]/g, "");
  if (!cleaned.startsWith("+")) return null;
  const digits = cleaned.replace(/^\+/, "");
  if (!/^\d{1,15}$/.test(digits)) return null;
  return `+${digits}`;
}

// Path to JSON file
const PHONE_FILE = path.join(process.cwd(), "phones.json");

/**
 * Save phone number to local JSON file keyed by accountid
 */
function savePhone(accountid: string, phone: string | null) {
  try {
    const existing = fs.existsSync(PHONE_FILE)
      ? JSON.parse(fs.readFileSync(PHONE_FILE, "utf8"))
      : {};
    existing[accountid] = phone;
    fs.writeFileSync(PHONE_FILE, JSON.stringify(existing, null, 2));
    if (DEBUG) console.log("Saved phone to JSON:", accountid, phone);
  } catch (err) {
    logError("savePhone", err, { accountid, phone });
  }
}

/**
 * Lookup phone number by accountid from JSON file
 */
export function getPhoneByAccountId(accountid: string): string | null {
  try {
    if (!fs.existsSync(PHONE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(PHONE_FILE, "utf8"));
    return data[accountid] ?? null;
  } catch (err) {
    logError("getPhoneByAccountId", err, { accountid });
    return null;
  }
}
// 🆕 Signup: create auth user + profile row
export async function signupUser(payload: {
  email: string;
  password: string;
  firstName: string;
  surname: string;
  country?: string;
  location?: string;
  role?: string;
  status?: string;
  nationalId?: string;
  bio?: string;
  metadata?: string[];
  avatarUrl?: string;
  dateOfBirth?: string;
  phone?: string;
}) {
  try {
    const normalizedPhone = normalizePhone(payload.phone);
    if (DEBUG) console.log("DEBUG normalizedPhone:", normalizedPhone);

    // Build args for Appwrite auth user creation
    const createArgs = [
      ID.unique(),
      payload.email,
      payload.password,
      `${payload.firstName} ${payload.surname}`,
    ];
    if (DEBUG) console.log("DEBUG users.create args:", createArgs);

    let authUser;
    try {
      authUser = await users.create(...createArgs);
      if (DEBUG) console.log("DEBUG authUser created:", authUser);
      savePhone(authUser.$id, normalizedPhone);
    } catch (err) {
      logError("users.create", err, { payload, createArgs });
      throw err;
    }

    let row;
    try {
      const rowPayload = {
        accountid: authUser.$id,
        email: payload.email.toLowerCase(),
        firstName: payload.firstName,
        surname: payload.surname,
        country: payload.country ?? null,
        location: payload.location ?? null,
        role: payload.role ?? "user",
        status: payload.status ?? "Active",
        nationalId: payload.nationalId ?? null,
        bio: payload.bio ?? null,
        metadata: payload.metadata ?? [],
        avatarUrl: payload.avatarUrl ?? null,
        dateOfBirth: payload.dateOfBirth ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (DEBUG) console.log("DEBUG tablesDB.createRow payload:", rowPayload);

      row = await tablesDB.createRow(
        DB_ID,
        USERS_TABLE,
        ID.unique(),
        rowPayload
      );
      if (DEBUG) console.log("DEBUG profile row created:", row);
    } catch (err) {
      logError("tablesDB.createRow", err, { payload });
      throw err;
    }

    return { authUser, profile: safeFormat(row) };
  } catch (err: unknown) {
    logError("signupUser", err, { payload });
    throw err;
  }
}

// ✅ Alias for backwards compatibility
export async function createUser(payload: Parameters<typeof signupUser>[0]) {
  return signupUser(payload);
}

// 🔎 Get by table row ID
export async function getUserById(userId: string): Promise<UserRow | null> {
  try {
    const row = await tablesDB.getRow(DB_ID, USERS_TABLE, userId);
    return safeFormat(row);
  } catch (err: unknown) {
    logError("getUserById", err, { userId });
    return null;
  }
}

// 🔎 Get by linked auth user ID
export async function getUserByAccountId(
  accountid: string
): Promise<UserRow | null> {
  try {
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
      Query.equal("accountid", accountid),
    ]);
    return res.total > 0 ? safeFormat(res.rows[0]) : null;
  } catch (err: unknown) {
    logError("getUserByAccountId", err, { accountid });
    return null;
  }
}

// 📋 List all users
export async function listUsers(limit = 100, offset = 0) {
  try {
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [], String(limit));
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const usersList = rows.slice(offset, offset + limit).map(safeFormat);
    return { total: res.total ?? usersList.length, users: usersList };
  } catch (err: unknown) {
    logError("listUsers", err, { limit, offset });
    return { total: 0, users: [] };
  }
}

// ✏️ Update profile row
export async function updateUser(
  userId: string,
  updates: Record<string, unknown>
) {
  try {
    if ("password" in updates) delete (updates as any).password;

    if ("phone" in updates) {
      const normalized = normalizePhone(updates.phone as string);
      if (normalized) {
        // Save to JSON file instead of Appwrite
        const user = await getUserById(userId);
        if (user?.accountid) savePhone(user.accountid, normalized);
      }
      delete updates.phone; // never store in Appwrite
    }

    const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, updates);
    return safeFormat(row);
  } catch (err: unknown) {
    logError("updateUser", err, { userId, updates });
    throw err;
  }
}

// ❌ Delete profile row
export async function deleteUser(userId: string) {
  try {
    return await tablesDB.deleteRow(DB_ID, USERS_TABLE, userId);
  } catch (err: unknown) {
    logError("deleteUser", err, { userId });
    throw err;
  }
}

// 🔧 Set role
export async function setRole(userId: string, role: string) {
  try {
    const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, { role });
    return safeFormat(row);
  } catch (err: unknown) {
    logError("setRole", err, { userId, role });
    throw err;
  }
}

// 🔎 Find by email
export async function findByEmail(email: string) {
  try {
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
      Query.equal("email", email.toLowerCase()),
    ]);
    return res.total > 0 ? safeFormat(res.rows[0]) : null;
  } catch (err: unknown) {
    logError("findByEmail", err, { email });
    return null;
  }
}

// 🔧 Set status
export async function setStatus(userId: string, status: string) {
  try {
    const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, {
      status,
    });
    return safeFormat(row);
  } catch (err: unknown) {
    logError("setStatus", err, { userId, status });
    throw err;
  }
}

// 🔎 List agents
export async function listAgents(limit = 100, offset = 0) {
  try {
    const res = await tablesDB.listRows(
      DB_ID,
      USERS_TABLE,
      [Query.equal("role", "agent")],
      String(limit)
    );
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const agentsList = rows.slice(offset, offset + limit).map(safeFormat);
    return { total: res.total ?? agentsList.length, agents: agentsList };
  } catch (err: unknown) {
    logError("listAgents", err, { limit, offset });
    return { total: 0, agents: [] };
  }
}
