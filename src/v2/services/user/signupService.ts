import { Databases, ID, Permission, Query, Role } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = getEnv("APPWRITE_USERS_COLLECTION") ?? "users";
const AGENT_APPLICATIONS_COLLECTION = "agent_profiles";
const NOTIFICATIONS_COLLECTION = "notifications";

type UserRole = "user" | "agent" | "admin";
type UserStatus = "Not Verified" | "Pending" | "Active" | "Suspended";

function db() {
  return new Databases(getClient());
}

/* =========================
   CREATE USER
========================= */
export async function createUserRow(payload: Record<string, any>) {
  const accountid = payload.accountid;
  if (!accountid) throw new Error("accountid is required");

  return db().createDocument(DB_ID, USERS_COLLECTION, ID.unique(), payload, [
    Permission.read(Role.user(accountid)),
    Permission.read(Role.team("admin")),
    Permission.update(Role.user(accountid)),
    Permission.update(Role.team("admin")),
    Permission.delete(Role.team("admin")),
  ]);
}

/* =========================
   DELETE USER BY ACCOUNT ID
========================= */
export async function deleteUserRowByAccountId(accountid: string) {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", accountid),
    Query.limit(1),
  ]);
  if (res.total === 0) return null;
  return db().deleteDocument(DB_ID, USERS_COLLECTION, res.documents[0].$id);
}

/* =========================
   GET USER
========================= */
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

/* =========================
   AGENT APPLICATIONS
========================= */
export async function submitAgentApplication(payload: {
  accountid: string; // REQUIRED
  fullname: string;
  message: string;
  agentId?: string | null;
  rating?: number | null;
  verified?: boolean | null;
}) {
  const doc: Record<string, any> = {
    accountid: payload.accountid,
    fullname: payload.fullname,
    message: payload.message,
  };
  if (payload.agentId) doc.agentId = payload.agentId;
  if (payload.rating !== undefined) doc.rating = payload.rating;
  if (payload.verified !== undefined) doc.verified = payload.verified;

  return db().createDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    ID.unique(),
    doc,
    [
      Permission.read(Role.team("admin")),
      Permission.update(Role.team("admin")),
      Permission.delete(Role.team("admin")),
    ]
  );
}

export async function listPendingApplications(limit = 50) {
  const res = await db().listDocuments(DB_ID, AGENT_APPLICATIONS_COLLECTION, [
    Query.equal("status", "pending"),
    Query.limit(limit),
  ]);
  return res.documents;
}

export async function getApplicationById(applicationId: string) {
  try {
    return await db().getDocument(
      DB_ID,
      AGENT_APPLICATIONS_COLLECTION,
      applicationId
    );
  } catch {
    return null;
  }
}

export async function approveApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");
  if (application.status === "approved") throw new Error("Already approved");

  const user = await getUserByAccountId(application.accountid);
  if (!user) throw new Error("User not found");

  await db().updateDocument(DB_ID, USERS_COLLECTION, user.$id, {
    roles: Array.from(new Set([...(user.roles || []), "agent", "user"])),
    status: "Active",
    approvedAt: new Date().toISOString(),
  });

  return db().updateDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    applicationId,
    {
      status: "approved",
      reviewedBy: adminId,
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes ?? null,
    }
  );
}

export async function rejectApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");

  return db().updateDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    applicationId,
    {
      status: "rejected",
      reviewedBy: adminId,
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes ?? null,
    }
  );
}
