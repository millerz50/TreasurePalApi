/* eslint-disable @typescript-eslint/no-explicit-any */
import sdk, {
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
} from "node-appwrite";

/**
 * NOTE
 * - This file was updated to avoid reading process.env at import time.
 * - It lazily loads env values so Render / production env vars are available.
 */

/* ----------------------------
   Lazy env helpers & client
   ---------------------------- */
function getEnv(key: string, fallback?: string): string | undefined {
  const v = process.env[key];
  if (v && v.length > 0) return v;
  return fallback;
}

function requireEnv(key: string): string {
  const v = getEnv(key);
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
}

let _client: Client | null = null;
function getClient(): Client {
  if (_client) return _client;

  // create client using environment variables (read at runtime)
  const endpoint = requireEnv("APPWRITE_ENDPOINT");
  const project = requireEnv("APPWRITE_PROJECT_ID");
  const apiKey = requireEnv("APPWRITE_API_KEY");

  _client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(apiKey);
  return _client;
}

/* create Appwrite services lazily */
function getTablesDB(): TablesDB {
  return new TablesDB(getClient());
}
function getAccounts() {
  return new sdk.Account(getClient());
}
function getUsersService() {
  return new sdk.Users(getClient());
}

/* get DB config at runtime */
const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";
const DEBUG = getEnv("DEBUG") === "true";

/* Validate minimal config at runtime */
if (!DB_ID) {
  // will throw only when functions attempt DB ops; keep here for early feedback
  // but don't crash on import in environments where DB isn't required immediately
  console.warn("Warning: APPWRITE_DATABASE_ID is not set.");
}

/* ----------------------------
   HELPERS
   ---------------------------- */
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
  try {
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
  } catch {
    // fallback
    console.error("logError failed", operation, err, context);
  }
}

/* ----------------------------
   SIGNUP USER
   ---------------------------- */
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
  otp?: string;
}) {
  logStep("START signupUser()", payload);

  const normalizedEmail = payload.email.toLowerCase().trim();

  const tablesDB = getTablesDB();
  const accounts = getAccounts();
  const usersService = getUsersService();

  // 0. Check if DB user already exists
  try {
    const existingUser = await findByEmail(normalizedEmail);
    if (existingUser) {
      const err = new Error("User already exists with this email.");
      (err as any).status = 409;
      throw err;
    }
  } catch (err) {
    // If DB is misconfigured, surface the error
    if ((err as any).status === 409) throw err;
    logStep("findByEmail error (continuing)", err);
  }

  // 1. Create Appwrite user in Auth
  let authUser: any;
  try {
    authUser = await accounts.create(
      ID.unique(),
      normalizedEmail,
      payload.password,
      `${payload.firstName} ${payload.surname}`
    );

    logStep("Auth user created", authUser);
  } catch (err: any) {
    logError("accounts.create FAILED", err, { email: normalizedEmail });
    throw err;
  }

  // 2. Phone Verification Flow (optional)
  if (payload.phone) {
    try {
      await accounts.createEmailPasswordSession(
        normalizedEmail,
        payload.password
      );
      logStep("Temporary session created");

      await accounts.updatePhone(payload.phone, payload.password);
      logStep("Phone set. Sending OTP…");

      const token = await accounts.createPhoneToken(
        authUser.$id,
        payload.phone
      );
      logStep("OTP sent", token);

      if (!payload.otp) {
        // return pending status so frontend can prompt OTP entry
        return {
          status: "PENDING_PHONE_VERIFICATION",
          message: "OTP sent to phone. Supply `otp` field to verify.",
          userId: authUser.$id,
        };
      }

      // if otp present, verify
      await accounts.updatePhoneSession(authUser.$id, payload.otp);
      logStep("Phone verification successful");

      // cleanup session
      try {
        await accounts.deleteSession("current");
      } catch {
        /* ignore */
      }
    } catch (err) {
      logError("PHONE_VERIFICATION_FAILED", err, {
        phone: payload.phone,
        email: normalizedEmail,
      });

      // rollback auth user on phone verification error
      try {
        await usersService.delete(authUser.$id);
        logStep(
          "Rollback: deleted auth user after phone failure",
          authUser.$id
        );
      } catch (rollbackErr) {
        logError("Rollback FAILED", rollbackErr, { authUserId: authUser.$id });
      }

      throw new Error("Phone verification failed. Wrong OTP?");
    }
  }

  // 3. Send email verification link (safe)
  try {
    const redirectUrl = getEnv("EMAIL_VERIFY_REDIRECT");
    if (!redirectUrl) {
      // do not throw — keep signup working; just log
      logError(
        "EMAIL_VERIFICATION_SKIPPED",
        "EMAIL_VERIFY_REDIRECT not configured",
        {}
      );
    } else {
      await accounts.createVerification(redirectUrl);
      logStep("Email verification sent");
    }
  } catch (err) {
    logError("EMAIL_VERIFICATION_FAILED", err, {});
    // we proceed — do not block signup if email verification fails
  }

  // 4. Create Database Profile
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
    agentId: ID.unique(),
  };

  // create DB row
  let row: any;
  try {
    if (!DB_ID) throw new Error("APPWRITE_DATABASE_ID is not configured");
    row = await tablesDB.createRow(
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
    logStep("Profile row created", row);
  } catch (err) {
    logError("tablesDB.createRow FAILED", err, { rowPayload });
    // rollback auth user to avoid orphaned auth accounts
    try {
      await usersService.delete(authUser.$id);
      logStep("Rollback: deleted Appwrite auth user", authUser.$id);
    } catch (rollbackErr) {
      logError("Rollback FAILED", rollbackErr, { authUserId: authUser.$id });
    }
    throw err;
  }

  // FINAL RESPONSE
  return {
    status: "SUCCESS",
    userId: authUser.$id, // Auth ID (Option A)
    profileId: row.$id, // DB Row ID
    authUser,
    profile: safeFormat(row),
  };
}

/* ----------------------------
   COMPATIBILITY
   ---------------------------- */
export async function createUser(payload: Parameters<typeof signupUser>[0]) {
  return signupUser(payload);
}

/* ----------------------------
   GETTERS / HELPERS
   ---------------------------- */
export async function getUserById(userId: string) {
  try {
    const tablesDB = getTablesDB();
    const row = await tablesDB.getRow(DB_ID, USERS_TABLE, userId);
    return safeFormat(row);
  } catch (err) {
    logError("getUserById", err, { userId });
    return null;
  }
}

export async function getUserByAccountId(accountid: string) {
  try {
    const tablesDB = getTablesDB();
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
    const tablesDB = getTablesDB();
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

export async function updateUser(
  userId: string,
  updates: Record<string, unknown>
) {
  try {
    const tablesDB = getTablesDB();
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
    const tablesDB = getTablesDB();
    return await tablesDB.deleteRow(DB_ID, USERS_TABLE, userId);
  } catch (err) {
    logError("deleteUser", err, { userId });
    throw err;
  }
}

export async function setRole(userId: string, role: string) {
  try {
    const tablesDB = getTablesDB();
    const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, { role });
    return safeFormat(row);
  } catch (err) {
    logError("setRole", err, { userId, role });
    throw err;
  }
}

export async function setStatus(userId: string, status: string) {
  try {
    const tablesDB = getTablesDB();
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
    const tablesDB = getTablesDB();
    const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
      Query.equal("email", email.toLowerCase()),
    ]);
    return res.total > 0 ? safeFormat(res.rows[0]) : null;
  } catch (err) {
    logError("findByEmail", err, { email });
    return null;
  }
}

export async function listAgents(limit = 100, offset = 0) {
  try {
    const tablesDB = getTablesDB();
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
