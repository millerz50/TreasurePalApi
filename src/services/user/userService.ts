import { Databases, ID, Permission, Query, Role } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = "users";

function db() {
  return new Databases(getClient());
}

/* ============================
   CREATE
============================ */

export async function createUserRow(payload: Record<string, any>) {
  const userId = payload.accountid; // MUST match Appwrite Auth userId

  if (!userId) {
    throw new Error("accountid is required to create user document");
  }

  return db().createDocument(DB_ID, USERS_COLLECTION, ID.unique(), payload, [
    // owner + admin can read
    Permission.read(Role.user(userId)),
    Permission.read(Role.team("admin")),

    // owner + admin can update
    Permission.update(Role.user(userId)),
    Permission.update(Role.team("admin")),

    // only admin can delete
    Permission.delete(Role.team("admin")),
  ]);
}

/* ============================
   READ
============================ */

export async function findByEmail(email: string) {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("email", email.toLowerCase()),
    Query.limit(1),
  ]);

  return res.total > 0 ? res.documents[0] : null;
}

export async function getUserByAccountId(accountid: string) {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", accountid),
    Query.limit(1),
  ]);

  return res.total > 0 ? res.documents[0] : null;
}

export async function getUserById(documentId: string) {
  try {
    return await db().getDocument(DB_ID, USERS_COLLECTION, documentId);
  } catch {
    return null;
  }
}

/* ============================
   UPDATE
============================ */

export async function updateUser(
  documentId: string,
  updates: Record<string, any>
) {
  return db().updateDocument(DB_ID, USERS_COLLECTION, documentId, updates);
}

/**
 * Replace all roles (admin-only operation)
 */
export async function setRoles(
  documentId: string,
  roles: ("user" | "agent" | "admin")[]
) {
  return updateUser(documentId, { roles });
}

export async function setStatus(
  documentId: string,
  status: "Not Verified" | "Pending" | "Active" | "Suspended"
) {
  return updateUser(documentId, { status });
}

/* ============================
   DELETE
============================ */

export async function deleteUser(documentId: string) {
  return db().deleteDocument(DB_ID, USERS_COLLECTION, documentId);
}

export async function deleteUserRowByAccountId(accountid: string) {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", accountid),
    Query.limit(1),
  ]);

  if (res.total === 0) return null;

  return deleteUser(res.documents[0].$id);
}

/* ============================
   LIST
============================ */

/**
 * Users that contain "agent" in roles[]
 */
export async function listAgents() {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.contains("roles", "agent"),
  ]);

  return res.documents;
}

export async function listUsers(limit = 100) {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.limit(limit),
  ]);

  return res.documents;
}

/* ============================
   CREDITS
============================ */

export async function getCredits(documentId: string): Promise<number> {
  const user = await getUserById(documentId);
  if (!user) throw new Error("User not found");

  return typeof user.credits === "number" ? user.credits : 0;
}

export async function addCredits(
  documentId: string,
  amount: number,
  reason = "manual"
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const user = await getUserById(documentId);
  if (!user) throw new Error("User not found");

  const updatedCredits =
    (typeof user.credits === "number" ? user.credits : 0) + amount;

  return updateUser(documentId, {
    credits: updatedCredits,
    lastCreditAction: {
      type: "add",
      amount,
      reason,
      at: new Date().toISOString(),
    },
  });
}

export async function deductCredits(
  documentId: string,
  amount: number,
  reason = "usage"
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const user = await getUserById(documentId);
  if (!user) throw new Error("User not found");

  const current = typeof user.credits === "number" ? user.credits : 0;
  if (current < amount) throw new Error("Insufficient credits");

  return updateUser(documentId, {
    credits: current - amount,
    lastCreditAction: {
      type: "deduct",
      amount,
      reason,
      at: new Date().toISOString(),
    },
  });
}
