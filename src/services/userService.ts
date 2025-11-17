// server/services/userService.ts
import { Client, Databases, ID, Query } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const USERS_COLLECTION = process.env.APPWRITE_USERS_COLLECTION_ID || "users";

type UserDoc = any;

function safeFormat(doc: any) {
  if (!doc) return null;
  const formatted = { ...doc };
  delete formatted.password;
  return formatted;
}

export async function getUserById(userId: string): Promise<UserDoc | null> {
  try {
    const doc = await databases.getDocument(DB_ID, USERS_COLLECTION, userId);
    return safeFormat(doc);
  } catch {
    return null;
  }
}

export async function getUserByAccountId(
  accountId: string
): Promise<UserDoc | null> {
  const res = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountId", accountId),
  ]);
  return res.total > 0 ? safeFormat(res.documents[0]) : null;
}

/**
 * List users with optional pagination.
 * Note: node-appwrite typings often accept up to 4 args for listDocuments.
 * We call with 4 args (limit) and apply offset client-side for compatibility.
 */
export async function listUsers(limit = 100, offset = 0) {
  const limitArg = String(limit ?? 100);

  const res = await databases.listDocuments(
    DB_ID,
    USERS_COLLECTION,
    [],
    limitArg
  );
  // apply offset client-side when requested
  const docs = Array.isArray(res.documents) ? res.documents : [];
  const sliced =
    offset && offset > 0
      ? docs.slice(offset, offset + Number(limit))
      : docs.slice(0, Number(limit));

  return {
    total: res.total ?? sliced.length,
    users: sliced.map(safeFormat),
  };
}

export async function createUser(payload: Record<string, any>) {
  const id = ID.unique();
  const doc = await databases.createDocument(
    DB_ID,
    USERS_COLLECTION,
    id,
    payload
  );
  return safeFormat(doc);
}

export async function updateUser(userId: string, updates: Record<string, any>) {
  if ("password" in updates) delete updates.password;
  const doc = await databases.updateDocument(
    DB_ID,
    USERS_COLLECTION,
    userId,
    updates
  );
  return safeFormat(doc);
}

export async function deleteUser(userId: string) {
  return await databases.deleteDocument(DB_ID, USERS_COLLECTION, userId);
}

export async function setRole(userId: string, role: string) {
  const doc = await databases.updateDocument(DB_ID, USERS_COLLECTION, userId, {
    role,
  });
  return safeFormat(doc);
}

export async function setStatus(userId: string, status: string) {
  const doc = await databases.updateDocument(DB_ID, USERS_COLLECTION, userId, {
    status,
  });
  return safeFormat(doc);
}

export async function findByEmail(email: string) {
  const res = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("email", email.toLowerCase()),
  ]);
  return res.total > 0 ? safeFormat(res.documents[0]) : null;
}
