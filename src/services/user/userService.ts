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

function getAccount(): Account {
  return new Account(getClient());
}

/* ------------------------------------------
    CONSTANTS
------------------------------------------- */

const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";
const DEBUG = getEnv("DEBUG") === "true";

if (!DB_ID) console.warn("Warning: APPWRITE_DATABASE_ID missing");

/* ------------------------------------------
    LOG UTILS (ADDED)
------------------------------------------- */

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
    SAFE FORMAT (ADDED)
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
  agentId?: string | null;
  bio?: string | null;
  phone?: string | null;
  password?: string;
}

function safeFormat(row: any): UserRow | null {
  if (!row || typeof row !== "object") return null;
  const f: any = { ...(row as Record<string, any>) };
  delete f.password; // never expose
  return f as UserRow;
}

/* ------------------------------------------
    SIGNUP USER (AUTH + DB)
------------------------------------------- */

export type SignupPayload = {
  accountId?: string;
  email: string;
  password: string;
  firstName: string;
  surname: string;

  // phone NOT saved on signup — saved later on login
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

  /* Prevent duplicate */
  const existing = await findByEmail(normalizedEmail).catch(() => null);
  if (existing) {
    const error: any = new Error("User already exists with this email.");
    error.status = 409;
    throw error;
  }

  /* 1️⃣ Create user in Appwrite Auth WITHOUT phone */
  let authUser;
  try {
    authUser = await account.create(
      accountId,
      normalizedEmail,
      payload.password
      // phone intentionally removed
    );
  } catch (err) {
    logError("signupUser.authCreate", err);
    throw err;
  }

  /* 2️⃣ Hash password for DB */
  const hashedPassword = await bcrypt.hash(payload.password, 10);

  /* 3️⃣ Create DB row (no phone) */
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
