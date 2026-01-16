import { Databases, ID, Permission, Query, Role } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = "users";
const AGENT_APPLICATIONS_COLLECTION = "agent_profiles";
const NOTIFICATIONS_COLLECTION = "notifications";

type UserRole = "user" | "agent" | "admin";

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
    Permission.update(Role.user(accountid)),
    Permission.read(Role.team("admin")),
    Permission.update(Role.team("admin")),
    Permission.delete(Role.team("admin")),
  ]);
}

/* =========================
   AGENT APPLICATIONS
========================= */
export async function submitAgentApplication(payload: {
  accountid: string;
  fullname: string;
  message: string;
  rating?: number | null;
  verified?: boolean | null;
}) {
  if (!payload.accountid) throw new Error("accountid is required");
  if (!payload.fullname) throw new Error("fullname is required");
  if (!payload.message) throw new Error("message is required");

  const doc = {
    accountid: payload.accountid,
    fullname: payload.fullname,
    message: payload.message,
    rating: payload.rating ?? null,
    verified: payload.verified ?? false, // agent profile verified
    createdAt: new Date().toISOString(),
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
  };

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

/* =========================
   LIST PENDING APPLICATIONS
   Pending = verified === false
========================= */
export async function listPendingApplications(limit = 50) {
  const res = await db().listDocuments(DB_ID, AGENT_APPLICATIONS_COLLECTION, [
    Query.equal("verified", false),
    Query.limit(limit),
  ]);
  return res.documents;
}

/* =========================
   READ USERS / AGENTS
========================= */
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

/* =========================
   UPDATE
========================= */
export async function updateUser(
  documentId: string,
  updates: Record<string, any>
) {
  return db().updateDocument(DB_ID, USERS_COLLECTION, documentId, updates);
}

/* =========================
   APPROVE / REJECT AGENT USER
========================= */
export async function approveAgent(documentId: string) {
  const user = await getUserById(documentId);
  if (!user) throw new Error("User not found");

  const roles = [
    ...new Set<UserRole>(["user", ...(user.roles ?? []), "agent"]),
  ];

  return updateUser(documentId, {
    roles,
    status: "Active", // ✅ user status
    approvedAt: new Date().toISOString(),
  });
}

/* =========================
   APPROVE / REJECT APPLICATION
========================= */
export async function approveApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");

  const userDoc = await getUserByAccountId(application.accountid);
  if (!userDoc) throw new Error("User document not found");

  // Approve user in USERS collection
  await approveAgent(userDoc.$id);

  const now = new Date().toISOString();
  // Update agent_profiles application
  await db().updateDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    applicationId,
    {
      verified: true, // ✅ mark agent application as approved
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNotes: reviewNotes ?? null,
    }
  );

  // Notification
  await db().createDocument(
    DB_ID,
    NOTIFICATIONS_COLLECTION,
    ID.unique(),
    {
      accountid: application.accountid,
      type: "agent_approved",
      message: "Your agent application has been approved.",
      createdAt: now,
      read: false,
    },
    [
      Permission.read(Role.user(application.accountid)),
      Permission.update(Role.user(application.accountid)),
      Permission.read(Role.team("admin")),
      Permission.delete(Role.team("admin")),
    ]
  );

  return { success: true };
}

export async function rejectApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");

  const now = new Date().toISOString();
  await db().updateDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    applicationId,
    {
      verified: false, // ✅ rejected
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNotes: reviewNotes ?? null,
    }
  );

  return { success: true };
}

/* =========================
   LIST USERS / AGENTS
========================= */
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
