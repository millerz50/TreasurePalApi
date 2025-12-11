/* eslint-disable @typescript-eslint/no-explicit-any */
import sdk, {
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
} from "node-appwrite";

/* ------------------------------------------
    LAZY ENV + CLIENT
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

  const endpoint = requireEnv("APPWRITE_ENDPOINT");
  const project = requireEnv("APPWRITE_PROJECT_ID");
  const apiKey = requireEnv("APPWRITE_API_KEY");

  _client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(apiKey);

  return _client;
}

function getTablesDB(): TablesDB {
  return new TablesDB(getClient());
}

function getAccounts() {
  return new sdk.Account(getClient());
}

function getUsersService() {
  return new sdk.Users(getClient());
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
  accountid?: string;
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

function safeFormat(row: unknown): UserRow | null {
  if (!row || typeof row !== "object") return null;
  const f = { ...(row as UserRow) };
  delete (f as any).password;
  return f;
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
    SIGNUP USER (Backend)
------------------------------------------- */

export async function signupUser(payload: {
  accountId: string; // <-- passed from frontend!
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
  otp?: string;
}) {
  logStep("START signupUser");

  const normalizedEmail = payload.email.toLowerCase().trim();
  const tablesDB = getTablesDB();
  const accounts = getAccounts();
  const usersService = getUsersService();

  const authUserId = payload.accountId; // <-- IMPORTANT

  /* 0. Check if DB profile exists */
  try {
    const existing = await findByEmail(normalizedEmail);
    if (existing) {
      const err: any = new Error("User already exists with this email.");
      err.status = 409;
      throw err;
    }
  } catch (err: any) {
    if (err.status === 409) throw err;
    logStep("findByEmail error safe-continuing", err);
  }

  /* 1. DO NOT create auth user here
        (Frontend already created it)
  */

  /* 2. Phone verification */
  if (payload.phone) {
    try {
      await usersService.updatePhone(authUserId, payload.phone);
      logStep("Phone updated");

      const token = await accounts.createPhoneToken(authUserId, payload.phone);

      logStep("OTP sent", token);

      if (!payload.otp) {
        return {
          status: "PENDING_PHONE_VERIFICATION",
          message: "OTP sent. Provide `otp` to continue signup.",
          userId: authUserId,
        };
      }

      await accounts.updatePhoneVerification(authUserId, payload.otp);
      logStep("Phone verification success");
    } catch (err) {
      logError("PHONE_VERIFY_FAIL", err, { phone: payload.phone });

      throw new Error("Phone verification failed. Wrong OTP?");
    }
  }

  /* 3. DB Profile Creation */
  const rowPayload: UserRow = {
    accountid: authUserId,
    email: normalizedEmail,
    firstName: payload.firstName,
    surname: payload.surname,
    country: payload.country ?? null,
    location: payload.location ?? null,
    role: payload.role ?? "user",
    status: payload.status ?? "Active",
    nationalId: payload.nationalId ?? null,
    bio: payload.bio ?? null,
    metadata: Array.isArray(payload.metadata) ? payload.metadata : [],
    dateOfBirth: payload.dateOfBirth ?? null,
    phone: payload.phone ?? null,
    agentId: ID.unique(),
  };

  let row: any;

  try {
    row = await tablesDB.createRow(
      DB_ID,
      USERS_TABLE,
      ID.unique(),
      rowPayload,
      [
        Permission.read(Role.user(authUserId)),
        Permission.update(Role.user(authUserId)),
        Permission.delete(Role.user(authUserId)),
      ]
    );
  } catch (err) {
    logError("DB_CREATE_FAIL", err, { rowPayload });
    throw err;
  }

  return {
    status: "SUCCESS",
    userId: authUserId,
    profileId: row.$id,
    profile: safeFormat(row),
  };
}

/* Compatibility */
export async function createUser(payload: Parameters<typeof signupUser>[0]) {
  return signupUser(payload);
}

/* ------------------------------------------
    GETTERS
------------------------------------------- */

export async function getUserById(id: string) {
  try {
    const tablesDB = getTablesDB();
    const row = await tablesDB.getRow(DB_ID, USERS_TABLE, id);
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
    LIST USERS
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
