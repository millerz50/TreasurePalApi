/* eslint-disable @typescript-eslint/no-explicit-any */
import sdk, {
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
} from "node-appwrite";

// ----------------------------
// INIT APPWRITE CLIENT
// ----------------------------
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

export const tablesDB = new TablesDB(client);
const accounts = new sdk.Account(client);
const usersService = new sdk.Users(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const USERS_TABLE = process.env.APPWRITE_USERTABLE_ID || "user";
const DEBUG = process.env.DEBUG === "true";

if (!DB_ID || !USERS_TABLE) {
  throw new Error(
    `❌ Missing Appwrite config: DB_ID=${DB_ID}, USERS_TABLE=${USERS_TABLE}`
  );
}

// ----------------------------
// HELPERS
// ----------------------------
export interface UserRow {
  $id?: string;
  accountid?: string;
  email?: string;
  password?: string;
  firstName?: string;
  surname?: string;
  role?: string;
  status?: string;
  nationalId?: string | null;
  bio?: string | null;
  metadata?: any[];
  country?: string | null;
  location?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  agentId?: string | null;
  [key: string]: unknown;
}

function safeFormat(row: unknown): UserRow | null {
  if (!row || typeof row !== "object") return null;
  const formatted = { ...(row as UserRow) };
  delete (formatted as any).password;
  return formatted;
}

function logStep(step: string, data?: any) {
  if (DEBUG) console.log("=== DEBUG STEP ===", step, data ?? "");
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
// ----------------------------
// SIGNUP USER (MAIN FUNCTION)
// ----------------------------
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
  metadata?: any[];
  dateOfBirth?: string;
  phone?: string;
}) {
  logStep("START signupUser()", payload);

  const normalizedEmail = payload.email.toLowerCase().trim();

  // 0. Check if DB user already exists
  const existingUser = await findByEmail(normalizedEmail);
  if (existingUser) {
    const err = new Error("User already exists with this email.");
    (err as any).status = 409;
    throw err;
  }

  // 1. Create Appwrite Auth user
  let authUser;
  try {
    authUser = await accounts.create(
      ID.unique(),
      normalizedEmail,
      payload.password, // stored ONLY inside Appwrite Auth (hashed)
      `${payload.firstName} ${payload.surname}`
    );

    logStep("Auth user created", authUser);

    // Store phone NUMBER inside Appwrite Auth
    if (payload.phone) {
      try {
        await accounts.updatePhone(payload.phone, payload.password);
        logStep("Phone updated in Appwrite", payload.phone);
      } catch (err) {
        logError("accounts.updatePhone FAILED", err, {
          phone: payload.phone,
          email: normalizedEmail,
        });
      }
    }
  } catch (err: any) {
    logError("accounts.create FAILED", err, { email: normalizedEmail });
    throw err;
  }

  // 2. Build DB row payload (NO PASSWORD, NO PHONE)
  const rowPayload: UserRow = {
    accountid: authUser.$id,
    email: normalizedEmail,
    firstName: payload.firstName,
    surname: payload.surname,
    country: payload.country ?? null,
    location: payload.location ?? null,
    role: payload.role ?? "user",
    status: payload.status ?? "Active",
    nationalId: payload.nationalId ?? null,
    bio: payload.bio ?? null,
    metadata: Array.isArray(payload.metadata) ? [...payload.metadata] : [],
    dateOfBirth: payload.dateOfBirth ?? null,
    // phone removed from DB — stored ONLY in auth
    agentId: ID.unique(),
  };

  logStep("Prepared DB rowPayload", rowPayload);

  // 3. Save DB Profile
  const rowId = ID.unique();
  let row;

  try {
    row = await tablesDB.createRow(DB_ID, USERS_TABLE, rowId, rowPayload, [
      Permission.read(Role.user(authUser.$id)),
      Permission.update(Role.user(authUser.$id)),
      Permission.delete(Role.user(authUser.$id)),
    ]);

    logStep("Profile row created successfully", row);
  } catch (err) {
    logError("tablesDB.createRow FAILED", err, { rowPayload });

    // rollback auth user
    try {
      await usersService.delete(authUser.$id);
      logStep("Rollback: deleted Appwrite auth user", authUser.$id);
    } catch (rollbackErr) {
      logError("Rollback FAILED", rollbackErr, { authUserId: authUser.$id });
    }

    throw err;
  }

  // delete session after signup (optional)
  try {
    await accounts.deleteSession("current");
  } catch {}

  return { authUser, profile: safeFormat(row) };
}

// ----------------------------
// COMPATIBILITY WRAPPER
// ----------------------------
export async function createUser(payload: Parameters<typeof signupUser>[0]) {
  return signupUser(payload);
}

// ----------------------------
// GETTER FUNCTIONS
// ----------------------------
export async function getUserById(userId: string) {
  try {
    const row = await tablesDB.getRow(DB_ID, USERS_TABLE, userId);
    return safeFormat(row);
  } catch (err) {
    logError("getUserById", err, { userId });
    return null;
  }
}

export async function getUserByAccountId(accountid: string) {
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

// ----------------------------
// LIST USERS
// ----------------------------
export async function listUsers(limit = 100, offset = 0) {
  try {
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [], String(limit));
    const rows = Array.isArray(res.rows) ? res.rows : [];
    return {
      total: res.total ?? rows.length,
      users: rows.slice(offset, offset + limit).map(safeFormat),
    };
  } catch (err) {
    logError("listUsers", err, { limit, offset });
    return { total: 0, users: [] };
  }
}

// ----------------------------
// UPDATE / DELETE
// ----------------------------
export async function updateUser(
  userId: string,
  updates: Record<string, unknown>
) {
  try {
    if ("password" in updates) delete (updates as any).password;
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

// ----------------------------
// ROLE & STATUS
// ----------------------------
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

// ----------------------------
// FIND BY EMAIL
// ----------------------------
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

// ----------------------------
// AGENT LIST
// ----------------------------
export async function listAgents(limit = 100, offset = 0) {
  try {
    const res = await tablesDB.listRows(
      DB_ID,
      USERS_TABLE,
      [Query.equal("role", "agent")],
      String(limit)
    );
    const rows = Array.isArray(res.rows) ? res.rows : [];
    return {
      total: res.total ?? rows.length,
      agents: rows.slice(offset, offset + limit).map(safeFormat),
    };
  } catch (err) {
    logError("listAgents", err, { limit, offset });
    return { total: 0, agents: [] };
  }
}
