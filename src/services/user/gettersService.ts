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

/* ======================================
   GET USER BY DOCUMENT ID
====================================== */
export async function getUserById(id: string): Promise<UserRow | null> {
  try {
    const row = await getTablesDB().getRow(DB_ID, USERS_TABLE, id);

    // ✅ Ensure credits always exist
    return safeFormat({
      ...row,
      credits: row.credits ?? 0,
    });
  } catch (err) {
    logError("getUserById", err, { id });
    return null;
  }
}

/* ======================================
   GET USER BY ACCOUNT ID
====================================== */
export async function getUserByAccountId(
  accountid: string
): Promise<UserRow | null> {
  try {
    const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
      Query.equal("accountid", accountid),
    ]);

    if (res.total === 0) return null;

    const row = res.rows[0];

    return safeFormat({
      ...row,
      credits: row.credits ?? 0,
    });
  } catch (err) {
    logError("getUserByAccountId", err, { accountid });
    return null;
  }
}

/* ======================================
   FIND USER BY EMAIL
====================================== */
export async function findByEmail(email: string): Promise<UserRow | null> {
  try {
    const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
      Query.equal("email", email.toLowerCase().trim()),
    ]);

    if (res.total === 0) return null;

    const row = res.rows[0];

    return safeFormat({
      ...row,
      credits: row.credits ?? 0,
    });
  } catch (err) {
    logError("findByEmail", err, { email });
    return null;
  }
}
