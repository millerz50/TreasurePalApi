import bcrypt from "bcryptjs";
import { Query, TablesDB } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";
import { logError, logStep } from "../../services/lib/logger";
import { safeFormat } from "../../services/lib/models/user";
import { getAccount } from "./authService";

const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";

function getTablesDB(): TablesDB {
  return new TablesDB(getClient());
}

export type SigninPayload = {
  email: string;
  password: string;
  phone?: string; // profile phone (DB)
  authPhone?: string; // verification phone (Auth)
};

export async function signinUser(payload: SigninPayload) {
  logStep("START signinUser", { email: payload.email });
  const tablesDB = getTablesDB();
  const account = getAccount();
  const normalizedEmail = payload.email.toLowerCase().trim();

  // Fetch user row
  const dbRow = await tablesDB.listRows(DB_ID, USERS_TABLE, [
    Query.equal("email", normalizedEmail),
  ]);
  const row = dbRow.total > 0 ? dbRow.rows[0] : null;
  if (!row) {
    const err: any = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  // Verify password against hashed DB password
  const match = await bcrypt.compare(payload.password, row.password || "");
  if (!match) {
    const err: any = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  // Create Appwrite session
  let session;
  try {
    session = await account.createSession(normalizedEmail, payload.password);
  } catch (err) {
    logError("signinUser.createSession", err);
    throw err;
  }

  // Update phones
  if (payload.authPhone) {
    try {
      // @ts-ignore
      if (typeof account.updatePhone === "function") {
        // @ts-ignore
        await account.updatePhone(payload.authPhone);
      }
    } catch (err) {
      logError("signinUser.updateAuthPhone", err, { email: normalizedEmail });
    }
  }

  if (payload.phone) {
    try {
      const updated = { ...row, phone: payload.phone };
      await tablesDB.updateRow(DB_ID, USERS_TABLE, row.$id, updated);
    } catch (err) {
      logError("signinUser.updateDbPhone", err, { profileId: row.$id });
    }
  }

  return {
    status: "SUCCESS",
    session,
    profile: safeFormat({
      ...row,
      phone: payload.phone ?? row.phone,
    }),
  };
}
