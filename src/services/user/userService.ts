/* lib/users.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */

import bcrypt from "bcryptjs";
import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
} from "node-appwrite";

/* ENV + CLIENT (unchanged) */
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
function getAccount(): Account {
  return new Account(getClient());
}

/* CONSTANTS */
const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";
const DEBUG = getEnv("DEBUG") === "true";
if (!DB_ID) console.warn("Warning: APPWRITE_DATABASE_ID missing");

/* LOG UTILS */
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

/* SAFE FORMAT */
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
  agentId?: string | null;
  bio?: string | null;
  phone?: string | null;
  password?: string;
}
function safeFormat(row: any): UserRow | null {
  if (!row || typeof row !== "object") return null;
  const f: any = { ...(row as Record<string, any>) };
  delete f.password;
  return f as UserRow;
}

/* SIGNUP USER */
export type SignupPayload = {
  accountId?: string;
  email: string;
  password: string;
  firstName: string;
  surname: string;
  phone?: string;
  country?: string;
  location?: string;
  role?: string;
  status?: string;
  nationalId?: string;
  bio?: string;
  metadata?: any[];
  dateOfBirth?: string;
};

export async function signupUser(payload: SignupPayload) {
  logStep("START signupUser", { email: payload.email });
  const tablesDB = getTablesDB();
  const account = getAccount();
  const normalizedEmail = payload.email.toLowerCase().trim();
  const accountId = payload.accountId ?? ID.unique();

  const existing = await findByEmail(normalizedEmail).catch(() => null);
  if (existing) {
    const error: any = new Error("User already exists with this email.");
    error.status = 409;
    throw error;
  }

  /* Create Appwrite Auth user (Appwrite manages auth credentials) */
  let authUser;
  try {
    authUser = await account.create(
      accountId,
      normalizedEmail,
      payload.password
    );
  } catch (err) {
    logError("signupUser.authCreate", err);
    throw err;
  }

  /* Hash password for DB only */
  const hashedPassword = await bcrypt.hash(payload.password, 10);

  /* Create DB row (store hashed password; phone optional) */
  const rowPayload: Record<string, any> = {
    accountid: accountId,
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
    password: hashedPassword,
    phone: payload.phone ?? null,
    agentId: payload.role === "agent" ? ID.unique() : null,
  };

  let createdRow;
  try {
    createdRow = await tablesDB.createRow(
      DB_ID,
      USERS_TABLE,
      ID.unique(),
      rowPayload,
      [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ]
    );
  } catch (err) {
    logError("signupUser.createRow", err);
    throw err;
  }

  return {
    status: "SUCCESS",
    userId: accountId,
    authUser,
    profileId: createdRow.$id,
    profile: safeFormat(createdRow),
  };
}

/* SIGNIN USER: verify DB hash, create Appwrite session, update phone in Auth + DB */
export type SigninPayload = {
  email: string;
  password: string;
  phone?: string;
};

export async function signinUser(payload: SigninPayload) {
  logStep("START signinUser", { email: payload.email });
  const tablesDB = getTablesDB();
  const account = getAccount();
  const normalizedEmail = payload.email.toLowerCase().trim();

  const profile = await findByEmail(normalizedEmail);
  if (!profile) {
    const err: any = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  /* Compare provided password with hashed DB password */
  const dbRow = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
    Query.equal("email", normalizedEmail),
  ]);
  const row = dbRow.total > 0 ? dbRow.rows[0] : null;
  if (!row) {
    const err: any = new Error("User row not found");
    err.status = 404;
    throw err;
  }

  const match = await bcrypt.compare(payload.password, row.password || "");
  if (!match) {
    const err: any = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  /* Create Appwrite session (auth) - use createSession which exists on Account */
  let session;
  try {
    session = await account.createSession(normalizedEmail, payload.password);
  } catch (err) {
    logError("signinUser.createSession", err);
    throw err;
  }

  /* Update phone in Appwrite Auth (best-effort) and DB */
  try {
    if (payload.phone) {
      // Update Auth phone (SDK method names vary by version; attempt best-effort update)
      try {
        // If your SDK exposes a typed method to update phone, replace this block with the proper call.
        // Use @ts-ignore to avoid TypeScript errors if the method is not present in the installed SDK types.
        // @ts-ignore
        if (typeof account.updatePhone === "function") {
          // @ts-ignore
          await account.updatePhone(payload.phone);
        }
      } catch (err) {
        logError("signinUser.updateAuthPhone", err, { email: normalizedEmail });
      }

      // Update DB row phone
      try {
        // Keep existing fields, but only update the phone value
        const updated = { ...row, phone: payload.phone };
        await tablesDB.updateRow(DB_ID, USERS_TABLE, row.$id, updated);
      } catch (err) {
        logError("signinUser.updateDbPhone", err, { profileId: row.$id });
      }
    }
  } catch (err) {
    logError("signinUser.updatePhones", err);
  }

  return {
    status: "SUCCESS",
    session,
    profile: safeFormat({ ...row, phone: payload.phone ?? row.phone }),
  };
}

/* GETTERS (unchanged) */
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
