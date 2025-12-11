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
// SIGNUP USER
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
  phone?: string | null;
}) {
  logStep("START signupUser()", payload);

  const email = (payload.email ?? "").toLowerCase().trim();
  if (!email) throw new Error("Email is required");

  // Check DB for profile
  const existingProfile = await findByEmail(email);
  if (existingProfile) {
    const err = new Error("User already exists with this email.");
    (err as any).status = 409;
    throw err;
  }

  // Check Appwrite Auth
  let existingAuthUser: any = null;
  try {
    const usersList = await usersService.list();
    existingAuthUser =
      usersList.users?.find(
        (u: any) => (u.email ?? "").toLowerCase() === email
      ) ?? null;
  } catch (err) {
    logStep("usersService.list failed (non-fatal)", err);
  }

  // If auth exists but DB does not — create DB only
  if (existingAuthUser) {
    const rowPayload: UserRow = {
      accountid: existingAuthUser.$id,
      email,
      firstName: payload.firstName,
      surname: payload.surname,
      country: payload.country ?? null,
      location: payload.location ?? null,
      role: payload.role ?? "user",
      status: payload.status ?? "Active",
      nationalId: payload.nationalId ?? null,
      bio: payload.bio ?? null,
      metadata: payload.metadata ?? [],
      dateOfBirth: payload.dateOfBirth ?? null,
      phone: payload.phone ?? null,
      agentId: ID.unique(),
    };

    const row = await tablesDB.createRow(
      DB_ID,
      USERS_TABLE,
      ID.unique(),
      rowPayload,
      [
        Permission.read(Role.user(existingAuthUser.$id)),
        Permission.update(Role.user(existingAuthUser.$id)),
        Permission.delete(Role.user(existingAuthUser.$id)),
      ]
    );

    return { authUser: existingAuthUser, profile: safeFormat(row) };
  }

  // Create Appwrite user
  let authUser: any;
  try {
    authUser = await accounts.create(
      ID.unique(),
      email,
      payload.password,
      `${payload.firstName} ${payload.surname}`
    );
  } catch (err: any) {
    logError("accounts.create FAILED", err, { email });

    const msg = (err.message ?? "").toLowerCase();
    if (msg.includes("exists") || msg.includes("same id")) {
      const conflict = new Error(
        "A user with the same id, email, or phone already exists."
      );
      (conflict as any).status = 409;
      throw conflict;
    }
    throw err;
  }

  // Create DB profile
  const rowPayload: UserRow = {
    accountid: authUser.$id,
    email,
    firstName: payload.firstName,
    surname: payload.surname,
    country: payload.country ?? null,
    location: payload.location ?? null,
    role: payload.role ?? "user",
    status: payload.status ?? "Active",
    nationalId: payload.nationalId ?? null,
    bio: payload.bio ?? null,
    metadata: payload.metadata ?? [],
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
        Permission.read(Role.user(authUser.$id)),
        Permission.update(Role.user(authUser.$id)),
        Permission.delete(Role.user(authUser.$id)),
      ]
    );

    return { authUser, profile: safeFormat(row) };
  } catch (err) {
    logError("tablesDB.createRow FAILED", err, { rowPayload });

    try {
      await usersService.delete(authUser.$id);
    } catch {
      logError("Rollback deleteAuthUser FAILED", err);
    }

    throw err;
  }
}

// ----------------------------
// GETTERS / UPDATE / DELETE
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

export async function listUsers(limit = 100, offset = 0) {
  try {
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [], String(limit));
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const usersList = rows.slice(offset, offset + limit).map(safeFormat);
    return { total: res.total ?? usersList.length, users: usersList };
  } catch (err) {
    logError("listUsers", err, { limit, offset });
    return { total: 0, users: [] };
  }
}

export async function updateUser(
  userId: string,
  updates: Record<string, unknown>
) {
  try {
    delete (updates as any).password;
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
    const agentsList = rows.slice(offset, offset + limit).map(safeFormat);
    return { total: res.total ?? agentsList.length, agents: agentsList };
  } catch (err) {
    logError("listAgents", err, { limit, offset });
    return { total: 0, agents: [] };
  }
}
