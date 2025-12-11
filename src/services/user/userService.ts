/* eslint-disable @typescript-eslint/no-explicit-any */
import sdk, {
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
} from "node-appwrite";

/* ============================================================
   LAZY ENV LOADING (Render-compatible)
   ============================================================ */
function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`❌ Missing env: ${key}`);
  return v;
}

/* ============================================================
   CREATE CLIENT (after env is available)
   ============================================================ */
function createClient() {
  const client = new Client()
    .setEndpoint(env("APPWRITE_ENDPOINT"))
    .setProject(env("APPWRITE_PROJECT_ID"))
    .setKey(env("APPWRITE_API_KEY"));
  return client;
}

const client = createClient();
export const tablesDB = new TablesDB(client);
const accounts = new sdk.Account(client);
const usersService = new sdk.Users(client);

const DB_ID = env("APPWRITE_DATABASE_ID");
const USERS_TABLE = process.env.APPWRITE_USERTABLE_ID || "user";
const DEBUG = process.env.DEBUG === "true";

/* ============================================================
   HELPERS
   ============================================================ */
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

/* ============================================================
   SIGNUP USER
   ============================================================ */
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

  // Check duplicates
  const existingUser = await findByEmail(normalizedEmail);
  if (existingUser) {
    const err = new Error("User already exists with this email.");
    (err as any).status = 409;
    throw err;
  }

  // Create auth user
  let authUser;
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

  /* ============================================================
     PHONE VERIFICATION
     ============================================================ */
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
        return {
          status: "PENDING_PHONE_VERIFICATION",
          message: "OTP sent to phone. Supply `otp` field to verify.",
          userId: authUser.$id,
        };
      }

      await accounts.updatePhoneSession(authUser.$id, payload.otp);

      logStep("Phone verification successful");

      await accounts.deleteSession("current");
    } catch (err) {
      logError("PHONE_VERIFICATION_FAILED", err, {
        phone: payload.phone,
        email: normalizedEmail,
      });
      throw new Error("Phone verification failed. Incorrect OTP.");
    }
  }

  /* ============================================================
     EMAIL VERIFICATION (with required URL)
     ============================================================ */
  try {
    const url = env("EMAIL_VERIFY_REDIRECT");
    await accounts.createVerification(url);
    logStep("Email verification sent");
  } catch (err) {
    logError("EMAIL_VERIFICATION_FAILED", err, {});
  }

  /* ============================================================
     CREATE USER PROFILE IN DATABASE
     ============================================================ */
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

  const rowId = ID.unique();
  let row;

  try {
    row = await tablesDB.createRow(DB_ID, USERS_TABLE, rowId, rowPayload, [
      Permission.read(Role.user(authUser.$id)),
      Permission.update(Role.user(authUser.$id)),
      Permission.delete(Role.user(authUser.$id)),
    ]);
  } catch (err) {
    logError("tablesDB.createRow FAILED", err, { rowPayload });
    await usersService.delete(authUser.$id);
    throw err;
  }

  return {
    status: "SUCCESS",
    userId: authUser.$id,
    profileId: row.$id,
    authUser,
    profile: safeFormat(row),
  };
}

/* ============================================================
   GETTERS
   ============================================================ */
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

/* ============================================================
   LIST USERS / AGENTS
   ============================================================ */
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

/* ============================================================
   UPDATES
   ============================================================ */
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

/* ============================================================
   SEARCH
   ============================================================ */
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
