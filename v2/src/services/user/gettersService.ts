import { Databases, Query } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";
import { logError } from "../../services/lib/logger";
import { safeFormat, UserRow } from "../../services/lib/models/user";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = "users";

function db() {
  return new Databases(getClient());
}

/* =========================
   Get by document ID
========================= */
export async function getUserById(id: string): Promise<UserRow | null> {
  try {
    const row = await db().getDocument(DB_ID, USERS_COLLECTION, id);
    return safeFormat({
      ...row,
      credits: row.credits ?? 0,
    });
  } catch (err) {
    logError("getUserById", err, { id });
    return null;
  }
}

/* =========================
   Get by account ID
========================= */
export async function getUserByAccountId(
  accountid: string
): Promise<UserRow | null> {
  try {
    const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
      Query.equal("accountid", accountid),
    ]);

    if (res.total === 0) return null;

    return safeFormat({
      ...res.documents[0],
      credits: res.documents[0].credits ?? 0,
    });
  } catch (err) {
    logError("getUserByAccountId", err, { accountid });
    return null;
  }
}

/* =========================
   Find by email
========================= */
export async function findByEmail(email: string): Promise<UserRow | null> {
  try {
    const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
      Query.equal("email", email.toLowerCase().trim()),
    ]);

    if (res.total === 0) return null;

    return safeFormat({
      ...res.documents[0],
      credits: res.documents[0].credits ?? 0,
    });
  } catch (err) {
    logError("findByEmail", err, { email });
    return null;
  }
}
