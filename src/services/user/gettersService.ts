// lib/services/gettersService.ts
import { Query, TablesDB } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";
import { logError } from "../../services/lib/logger";
import { safeFormat, UserRow } from "../../services/lib/models/user";

const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";

function getTablesDB(): TablesDB {
  return new TablesDB(getClient());
}

export async function getUserById(id: string): Promise<UserRow | null> {
  try {
    const row = await getTablesDB().getRow(DB_ID, USERS_TABLE, id);
    return safeFormat(row);
  } catch (err) {
    logError("getUserById", err, { id });
    return null;
  }
}

export async function getUserByAccountId(
  accountid: string
): Promise<UserRow | null> {
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

export async function findByEmail(email: string): Promise<UserRow | null> {
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
