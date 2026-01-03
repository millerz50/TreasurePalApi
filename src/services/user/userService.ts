import { Databases, ID, Permission, Query, Role } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = "users";
const AGENT_APPLICATIONS_COLLECTION = "agent_profiles";
const NOTIFICATIONS_COLLECTION = "notifications";

type UserRole = "user" | "agent" | "admin";
type UserStatus = "Not Verified" | "Pending" | "Active" | "Suspended";

function db() {
  return new Databases(getClient());
}

/* ============================
   CREATE
============================ */

export async function createUserRow(payload: Record<string, any>) {
  const userId = payload.accountid;
  if (!userId) throw new Error("accountid is required to create user document");

  return db().createDocument(DB_ID, USERS_COLLECTION, ID.unique(), payload, [
    Permission.read(Role.user(userId)),
    Permission.read(Role.team("admin")),
    Permission.update(Role.user(userId)),
    Permission.update(Role.team("admin")),
    Permission.delete(Role.team("admin")),
  ]);
}

/* ============================
   AGENT APPLICATIONS
============================ */
export async function submitAgentApplication(payload: {
  userId: string;
  fullname: string;
  message: string;
  licenseNumber?: string | null;
  agencyId?: string | null;
  rating?: number | null;
  verified?: boolean | null;
}) {
  // ----------------------------
  // Validate payload
  // ----------------------------
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }

  if (!payload.userId || typeof payload.userId !== "string") {
    throw new Error("userId is required and must be a string");
  }

  if (!payload.fullname || typeof payload.fullname !== "string") {
    throw new Error("fullname is required and must be a string");
  }

  if (!payload.message || typeof payload.message !== "string") {
    throw new Error("message is required and must be a string");
  }

  console.log(
    "submitAgentApplication: Incoming payload:",
    JSON.stringify(payload, null, 2)
  );

  // ----------------------------
  // Build Appwrite-safe document
  // ----------------------------
  const doc = {
    userId: payload.userId,
    fullname: payload.fullname,
    message: payload.message,
    licenseNumber: payload.licenseNumber ?? null,
    agencyId: payload.agencyId ?? null,
    rating: payload.rating ?? null,
    verified: payload.verified ?? null,
  };

  console.log(
    "submitAgentApplication: Appwrite document:",
    JSON.stringify(doc, null, 2)
  );

  // ----------------------------
  // Insert document
  // ----------------------------
  try {
    const result = await db().createDocument(
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

    console.log("submitAgentApplication: Created:", result);
    return result;
  } catch (err) {
    console.error("submitAgentApplication: Appwrite error:", err);
    throw err;
  }
}
export async function listPendingApplications(limit = 50) {
  const res = await db().listDocuments(DB_ID, AGENT_APPLICATIONS_COLLECTION, [
    Query.equal("status", "pending"),
    Query.limit(limit),
  ]);
  return res.documents;
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

/* ============================
   UPDATE
============================ */

export async function updateUser(
  documentId: string,
  updates: Record<string, any>
) {
  return db().updateDocument(DB_ID, USERS_COLLECTION, documentId, updates);
}

export async function setRoles(documentId: string, roles: UserRole[]) {
  if (!roles.includes("user")) roles.push("user");
  return updateUser(documentId, { roles: Array.from(new Set(roles)) });
}

export async function approveAgent(documentId: string) {
  const user = await getUserById(documentId);
  if (!user) throw new Error("User not found");

  const existingRoles: UserRole[] = Array.isArray(user.roles)
    ? user.roles
    : ["user"];
  const roles = Array.from(
    new Set<UserRole>(["user", ...existingRoles, "agent"])
  );

  return updateUser(documentId, {
    roles,
    status: "Active",
    approvedAt: new Date().toISOString(),
  });
}

export async function approveApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");
  if (application.status === "approved")
    throw new Error("Application already approved");

  const accountid = application.accountid;
  if (!accountid) throw new Error("Application missing accountid");

  const userDoc = await getUserByAccountId(accountid);
  if (!userDoc) throw new Error("User document not found for accountid");

  await approveAgent(userDoc.$id);

  const now = new Date().toISOString();
  await db().updateDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    applicationId,
    {
      status: "approved",
      reviewedAt: now,
      reviewedBy: adminId,
      reviewNotes: reviewNotes ?? null,
    }
  );

  try {
    await db().createDocument(
      DB_ID,
      NOTIFICATIONS_COLLECTION,
      ID.unique(),
      {
        accountid,
        type: "agent_approved",
        message: "Your agent application has been approved.",
        createdAt: now,
        read: false,
      },
      [
        Permission.read(Role.user(accountid)),
        Permission.update(Role.user(accountid)),
        Permission.delete(Role.team("admin")),
        Permission.read(Role.team("admin")),
      ]
    );
  } catch (err) {
    console.warn("Failed to create notification for approved agent:", err);
  }

  return { success: true, applicationId, userDocumentId: userDoc.$id };
}

export async function rejectApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");
  if (application.status === "approved")
    throw new Error("Cannot reject an already approved application");

  const now = new Date().toISOString();
  await db().updateDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    applicationId,
    {
      status: "rejected",
      reviewedAt: now,
      reviewedBy: adminId,
      reviewNotes: reviewNotes ?? null,
    }
  );

  try {
    await db().createDocument(
      DB_ID,
      NOTIFICATIONS_COLLECTION,
      ID.unique(),
      {
        accountid: application.accountid,
        type: "agent_rejected",
        message:
          "Your agent application was not approved. Please contact support for details.",
        createdAt: now,
        read: false,
      },
      [
        Permission.read(Role.user(application.accountid)),
        Permission.update(Role.user(application.accountid)),
        Permission.delete(Role.team("admin")),
        Permission.read(Role.team("admin")),
      ]
    );
  } catch (err) {
    console.warn("Failed to create rejection notification:", err);
  }

  return { success: true, applicationId };
}

export async function promoteToAdmin(documentId: string) {
  const user = await getUserById(documentId);
  if (!user) throw new Error("User not found");

  const existingRoles: UserRole[] = Array.isArray(user.roles)
    ? user.roles
    : ["user"];
  const roles = Array.from(
    new Set<UserRole>(["user", ...existingRoles, "admin"])
  );
  return updateUser(documentId, { roles });
}

export async function setStatus(documentId: string, status: UserStatus) {
  return updateUser(documentId, { status });
}

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
  const current = typeof user.credits === "number" ? user.credits : 0;

  return updateUser(documentId, {
    credits: current + amount,
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
