// server/services/userService.ts
import { Client, Databases, ID, Query, Users } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

// Appwrite services
const databases = new Databases(client);
const users = new Users(client);

// Config
const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || "user";
const DEBUG = process.env.DEBUG === "true";

if (!DB_ID || !USERS_COLLECTION_ID) {
  throw new Error(
    `❌ Missing Appwrite config: DB_ID=${DB_ID}, USERS_COLLECTION_ID=${USERS_COLLECTION_ID}`
  );
}

type UserDoc = Record<string, unknown>;

function safeFormat(doc: unknown): UserDoc | null {
  if (!doc || typeof doc !== "object") return null;
  const formatted = { ...(doc as Record<string, unknown>) };
  delete formatted.password;
  return formatted;
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

export async function getUserById(docId: string): Promise<UserDoc | null> {
  try {
    const doc = await databases.getDocument(DB_ID, USERS_COLLECTION_ID, docId);
    return safeFormat(doc);
  } catch (err: unknown) {
    logError("getUserById", err, { docId });
    return null;
  }
}

export async function getUserByAccountId(
  accountid: string
): Promise<UserDoc | null> {
  try {
    const res = await databases.listDocuments(DB_ID, USERS_COLLECTION_ID, [
      Query.equal("accountid", accountid),
    ]);
    return res.total > 0 ? safeFormat(res.documents[0]) : null;
  } catch (err: unknown) {
    logError("getUserByAccountId", err, { accountid });
    return null;
  }
}

export async function listUsers(limit = 100, offset = 0) {
  try {
    const res = await databases.listDocuments(
      DB_ID,
      USERS_COLLECTION_ID,
      [],
      String(limit) // ✅ cast to string
    );
    const docs = Array.isArray(res.documents) ? res.documents : [];
    const users = docs.slice(offset, offset + limit).map(safeFormat);
    return { total: res.total ?? users.length, users };
  } catch (err: unknown) {
    logError("listUsers", err, { limit, offset });
    return { total: 0, users: [] };
  }
}

/**
 * Create an Appwrite auth user AND a profile document.
 */
export async function signupUser(payload: {
  email: string;
  password: string;
  firstName: string;
  surname: string;
  role?: "user" | "agent";
  status?: "Not Verified" | "Pending" | "Active" | "Suspended";
  phone?: string | null;
  nationalId?: string | null;
  bio?: string | null;
  metadata?: string[];
  avatarFileId?: string | null;
}) {
  try {
    // 1) Create auth user with a valid ID
    const authUserId = ID.unique();
    const name = `${payload.firstName} ${payload.surname}`.trim();

    const authUser = await users.create(authUserId, payload.email);
    await users.updatePassword(authUser.$id, payload.password);
    await users.updateName(authUser.$id, name);

    // 2) Create profile document referencing auth `$id`
    const docId = ID.unique();
    const profile: Record<string, unknown> = {
      accountid: authUser.$id,
      email: payload.email.toLowerCase(),
      firstName: payload.firstName,
      surname: payload.surname,
      role: payload.role ?? "user",
      status: payload.status ?? "Pending",
      phone: payload.phone ?? null,
      nationalId: payload.nationalId ?? null,
      bio: payload.bio ?? null,
      metadata: payload.metadata ?? [],
      avatarFileId: payload.avatarFileId ?? null,
    };

    const doc = await databases.createDocument(
      DB_ID,
      USERS_COLLECTION_ID,
      docId,
      profile
    );

    if (DEBUG) console.log("signupUser auth:", authUser, "profile:", doc);
    return safeFormat(doc);
  } catch (err: unknown) {
    logError("signupUser", err, { payload: { email: payload.email } });
    throw err;
  }
}

// ✅ Alias for backwards compatibility
export async function createUser(payload: Parameters<typeof signupUser>[0]) {
  return signupUser(payload);
}

export async function updateUser(
  docId: string,
  updates: Record<string, unknown>
) {
  try {
    if ("password" in updates) delete updates.password;
    const doc = await databases.updateDocument(
      DB_ID,
      USERS_COLLECTION_ID,
      docId,
      updates
    );
    return safeFormat(doc);
  } catch (err: unknown) {
    logError("updateUser", err, { docId, updates });
    throw err;
  }
}

export async function deleteUser(docId: string) {
  try {
    return await databases.deleteDocument(DB_ID, USERS_COLLECTION_ID, docId);
  } catch (err: unknown) {
    logError("deleteUser", err, { docId });
    throw err;
  }
}

export async function setRole(docId: string, role: string) {
  try {
    const doc = await databases.updateDocument(
      DB_ID,
      USERS_COLLECTION_ID,
      docId,
      { role }
    );
    return safeFormat(doc);
  } catch (err: unknown) {
    logError("setRole", err, { docId, role });
    throw err;
  }
}

export async function setStatus(docId: string, status: string) {
  try {
    const doc = await databases.updateDocument(
      DB_ID,
      USERS_COLLECTION_ID,
      docId,
      { status }
    );
    return safeFormat(doc);
  } catch (err: unknown) {
    logError("setStatus", err, { docId, status });
    throw err;
  }
}

export async function findByEmail(email: string) {
  try {
    const res = await databases.listDocuments(DB_ID, USERS_COLLECTION_ID, [
      Query.equal("email", email.toLowerCase()),
    ]);
    return res.total > 0 ? safeFormat(res.documents[0]) : null;
  } catch (err: unknown) {
    logError("findByEmail", err, { email });
    return null;
  }
}
