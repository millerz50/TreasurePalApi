// src/v2/services/user/userService.ts
import { Databases, ID, Permission, Query, Role } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";

/* =========================
   ENV / CONSTANTS
========================= */
const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = "users";
const AGENT_APPLICATIONS_COLLECTION = "agent_profiles";
const NOTIFICATIONS_COLLECTION = "notifications";
const ACTIVITY_COLLECTION =
  getEnv("APPWRITE_ACTIVITY_COLLECTION") ?? "activity";

/* =========================
   TYPES
========================= */
export type UserRole = "user" | "agent" | "admin";
export type UserStatus = "Not Verified" | "Pending" | "Active" | "Suspended";

export interface CreditDocument {
  accountid: string;
  balance: number;
}

/* =========================
   DB HELPER
========================= */
function db() {
  return new Databases(getClient());
}

/* =========================
   ACTIVITY LOGGER (SAFE)
========================= */
async function logActivity(payload: {
  actorId: string;
  actorRole?: string;
  action: string;
  message: string;
  amount?: number;
  refId?: string;
  refType?: string;
}) {
  try {
    await db().createDocument(DB_ID, ACTIVITY_COLLECTION, ID.unique(), {
      actorId: payload.actorId,
      actorRole: payload.actorRole ?? "user",
      action: payload.action,
      message: payload.message,
      amount: payload.amount ?? null,
      refId: payload.refId ?? null,
      refType: payload.refType ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // activity must never break business logic
  }
}

/* =========================
   USERS
========================= */
export async function createUserRow(payload: Record<string, any>) {
  if (!payload.accountid) throw new Error("accountid is required");

  const doc = await db().createDocument(
    DB_ID,
    USERS_COLLECTION,
    ID.unique(),
    payload,
    [
      Permission.read(Role.user(payload.accountid)),
      Permission.update(Role.user(payload.accountid)),
      Permission.read(Role.team("admin")),
      Permission.update(Role.team("admin")),
      Permission.delete(Role.team("admin")),
    ],
  );

  await logActivity({
    actorId: payload.accountid,
    action: "user_created",
    message: "User profile created",
    refId: doc.$id,
    refType: "user",
  });

  return doc;
}

export async function listUsers() {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION);
  return res.documents;
}

export async function listAgents() {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("roles", "agent"),
  ]);
  return res.documents;
}

export async function getUserByAccountId(accountid: string) {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", accountid),
    Query.limit(1),
  ]);
  return res.total ? res.documents[0] : null;
}

export async function getUserById(documentId: string) {
  try {
    return await db().getDocument(DB_ID, USERS_COLLECTION, documentId);
  } catch {
    return null;
  }
}

export async function findByEmail(email: string) {
  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("email", email),
    Query.limit(1),
  ]);
  return res.total ? res.documents[0] : null;
}

/* =========================
   UPDATE / DELETE
========================= */
export async function deleteUser(documentId: string) {
  return db().deleteDocument(DB_ID, USERS_COLLECTION, documentId);
}

export async function setRoles(documentId: string, roles: UserRole[]) {
  return db().updateDocument(DB_ID, USERS_COLLECTION, documentId, { roles });
}

export async function setStatus(documentId: string, status: UserStatus) {
  return db().updateDocument(DB_ID, USERS_COLLECTION, documentId, { status });
}

export async function updateUser(
  documentId: string,
  updates: Record<string, any>,
) {
  return db().updateDocument(DB_ID, USERS_COLLECTION, documentId, updates);
}

/* =========================
   CREDITS (USERS COLLECTION)
========================= */
export async function getCredits(accountid: string): Promise<CreditDocument> {
  const user = await getUserByAccountId(accountid);
  if (!user) throw new Error("User not found");

  return {
    accountid,
    balance: user.credits || 0,
  };
}

export async function addCredits(accountid: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const user = await getUserByAccountId(accountid);
  if (!user) throw new Error("User not found");

  const newBalance = (user.credits || 0) + amount;
  await updateUser(user.$id, { credits: newBalance });

  await logActivity({
    actorId: accountid,
    action: "credits_added",
    message: `Credits added (+${amount})`,
    amount,
    refId: user.$id,
    refType: "user",
  });

  return { accountid, balance: newBalance };
}

export async function deductCredits(accountid: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const user = await getUserByAccountId(accountid);
  if (!user) throw new Error("User not found");

  if ((user.credits || 0) < amount) {
    throw new Error("Insufficient credits");
  }

  const newBalance = (user.credits || 0) - amount;
  await updateUser(user.$id, { credits: newBalance });

  await logActivity({
    actorId: accountid,
    action: "credits_deducted",
    message: `Credits deducted (-${amount})`,
    amount: -amount,
    refId: user.$id,
    refType: "user",
  });

  return { accountid, balance: newBalance };
}

/* =========================
   AGENT APPLICATIONS
========================= */
export async function submitAgentApplication(payload: {
  userId: string;
  fullname: string;
  message: string;
  rating?: number | null;
  verified?: boolean;
}) {
  if (!payload.userId || !payload.fullname || !payload.message) {
    throw new Error("userId, fullname, and message are required");
  }

  const doc = await db().createDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    ID.unique(),
    {
      userId: payload.userId,
      fullname: payload.fullname,
      message: payload.message,
      rating: payload.rating ?? null,
      verified: payload.verified ?? false,
    },
    [
      Permission.read(Role.team("admin")),
      Permission.update(Role.team("admin")),
      Permission.delete(Role.team("admin")),
    ],
  );

  await logActivity({
    actorId: payload.userId,
    action: "agent_application_submitted",
    message: "Agent application submitted",
    refId: doc.$id,
    refType: "agent_application",
  });

  return doc;
}

export async function listPendingApplications(limit = 50) {
  const res = await db().listDocuments(DB_ID, AGENT_APPLICATIONS_COLLECTION, [
    Query.equal("verified", false),
    Query.limit(limit),
  ]);
  return res.documents;
}

export async function getApplicationById(applicationId: string) {
  try {
    return await db().getDocument(
      DB_ID,
      AGENT_APPLICATIONS_COLLECTION,
      applicationId,
    );
  } catch {
    return null;
  }
}

/* =========================
   APPROVAL FLOW
========================= */
export async function approveAgent(userDocumentId: string) {
  const user = await getUserById(userDocumentId);
  if (!user) throw new Error("User not found");

  const roles: UserRole[] = Array.from(
    new Set([...(user.roles ?? []), "agent", "user"]),
  );

  await updateUser(userDocumentId, {
    roles,
    status: "Active",
  });

  await logActivity({
    actorId: user.accountid,
    actorRole: "admin",
    action: "agent_approved",
    message: "User promoted to agent",
    refId: user.$id,
    refType: "user",
  });
}

export async function approveApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string,
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");

  const userDoc = await getUserByAccountId(application.userId);
  if (!userDoc) throw new Error("User document not found");

  await approveAgent(userDoc.$id);

  const now = new Date().toISOString();

  await db().updateDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    applicationId,
    {
      verified: true,
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNotes: reviewNotes ?? null,
    },
  );

  await logActivity({
    actorId: adminId,
    actorRole: "admin",
    action: "agent_application_approved",
    message: "Agent application approved",
    refId: applicationId,
    refType: "agent_application",
  });

  await db().createDocument(
    DB_ID,
    NOTIFICATIONS_COLLECTION,
    ID.unique(),
    {
      accountid: application.userId,
      type: "agent_approved",
      message: "Your agent application has been approved.",
      createdAt: now,
      read: false,
    },
    [
      Permission.read(Role.user(application.userId)),
      Permission.update(Role.user(application.userId)),
      Permission.read(Role.team("admin")),
      Permission.delete(Role.team("admin")),
    ],
  );

  return { success: true };
}

export async function rejectApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string,
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");

  await db().updateDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    applicationId,
    {
      verified: false,
      reviewedBy: adminId,
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes ?? null,
    },
  );

  await logActivity({
    actorId: adminId,
    actorRole: "admin",
    action: "agent_application_rejected",
    message: "Agent application rejected",
    refId: applicationId,
    refType: "agent_application",
  });

  return { success: true };
}
