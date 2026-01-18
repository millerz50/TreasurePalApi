import { Databases, ID, Permission, Query, Role } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = "users";
const AGENT_APPLICATIONS_COLLECTION = "agent_profiles";
const NOTIFICATIONS_COLLECTION = "notifications";

type UserRole = "user" | "agent" | "admin";
type UserStatus = "Not Verified" | "Pending" | "Active" | "Suspended";

/* =========================
   DB HELPER
========================= */
function db() {
  return new Databases(getClient());
}

/* =========================
   CREATE USER
========================= */
export async function createUserRow(payload: Record<string, any>) {
  console.log("[createUserRow] payload:", payload);

  const accountId = payload.accountid; // ✅ match schema
  if (!accountId) {
    console.error("[createUserRow] ❌ accountid missing");
    throw new Error("accountid is required");
  }

  const result = await db().createDocument(
    DB_ID,
    USERS_COLLECTION,
    ID.unique(),
    payload,
    [
      Permission.read(Role.user(accountId)),
      Permission.update(Role.user(accountId)),
      Permission.read(Role.team("admin")),
      Permission.update(Role.team("admin")),
      Permission.delete(Role.team("admin")),
    ],
  );

  console.log("[createUserRow] ✅ created user:", result.$id);
  return result;
}

/* =========================
   FIND USER BY EMAIL
========================= */
export async function findByEmail(email: string) {
  console.log("[findByEmail] email:", email);

  if (!email) throw new Error("email is required");

  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("email", email.toLowerCase()),
    Query.limit(1),
  ]);

  console.log("[findByEmail] found:", res.total);
  return res.total ? res.documents[0] : null;
}

/* =========================
   SUBMIT AGENT APPLICATION
========================= */
export async function submitAgentApplication(payload: {
  userId: string;
  fullname: string;
  message: string;
  rating?: number | null;
  verified?: boolean;
}) {
  console.log("[submitAgentApplication] payload:", payload);

  if (!payload.userId) throw new Error("userId is required");
  if (!payload.fullname) throw new Error("fullname is required");
  if (!payload.message) throw new Error("message is required");

  const result = await db().createDocument(
    DB_ID,
    AGENT_APPLICATIONS_COLLECTION,
    ID.unique(),
    {
      userId: payload.userId,
      fullname: payload.fullname,
      message: payload.message,
      rating: payload.rating ?? null,
      verified: payload.verified ?? false,
      createdAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.team("admin")),
      Permission.update(Role.team("admin")),
      Permission.delete(Role.team("admin")),
    ],
  );

  console.log("[submitAgentApplication] ✅ applicationId:", result.$id);
  return result;
}

/* =========================
   LIST PENDING APPLICATIONS
========================= */
export async function listPendingApplications(limit = 50) {
  console.log("[listPendingApplications] limit:", limit);

  const res = await db().listDocuments(DB_ID, AGENT_APPLICATIONS_COLLECTION, [
    Query.equal("verified", false),
    Query.limit(limit),
  ]);

  console.log("[listPendingApplications] found:", res.total);
  return res.documents;
}

/* =========================
   USERS
========================= */
export async function getUserByAccountId(accountId: string) {
  console.log("[getUserByAccountId] accountId:", accountId);

  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", accountId), // ✅ match schema lowercase
    Query.limit(1),
  ]);

  console.log("[getUserByAccountId] found:", res.total);
  return res.total ? res.documents[0] : null;
}

export async function getUserById(documentId: string) {
  console.log("[getUserById] documentId:", documentId);

  try {
    const user = await db().getDocument(DB_ID, USERS_COLLECTION, documentId);
    console.log("[getUserById] ✅ found");
    return user;
  } catch (err) {
    console.error("[getUserById] ❌ not found");
    return null;
  }
}

/* =========================
   APPLICATIONS
========================= */
export async function getApplicationById(applicationId: string) {
  console.log("[getApplicationById] applicationId:", applicationId);

  try {
    const app = await db().getDocument(
      DB_ID,
      AGENT_APPLICATIONS_COLLECTION,
      applicationId,
    );
    console.log("[getApplicationById] ✅ found");
    return app;
  } catch {
    console.error("[getApplicationById] ❌ not found");
    return null;
  }
}

/* =========================
   USER UPDATES
========================= */
export async function updateUser(
  documentId: string,
  updates: Record<string, any>,
) {
  console.log("[updateUser] documentId:", documentId, "updates:", updates);
  return db().updateDocument(DB_ID, USERS_COLLECTION, documentId, updates);
}

/* =========================
   APPROVE AGENT USER
========================= */
export async function approveAgent(userDocumentId: string) {
  console.log("[approveAgent] userDocumentId:", userDocumentId);

  const user = await getUserById(userDocumentId);
  if (!user) {
    console.error("[approveAgent] ❌ user not found");
    throw new Error("User not found");
  }

  const roles: UserRole[] = Array.from(
    new Set([...(user.roles ?? []), "agent", "user"]),
  );

  const result = await updateUser(userDocumentId, {
    roles,
    status: "Active",
    approvedAt: new Date().toISOString(),
  });

  console.log("[approveAgent] ✅ approved");
  return result;
}

/* =========================
   APPROVE APPLICATION
========================= */
export async function approveApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string,
) {
  console.log("[approveApplication] START", {
    applicationId,
    adminId,
    reviewNotes,
  });

  const application = await getApplicationById(applicationId);
  if (!application) {
    console.error("[approveApplication] ❌ application not found");
    throw new Error("Application not found");
  }

  console.log("[approveApplication] application.userId:", application.userId);

  const userDoc = await getUserByAccountId(application.userId);
  if (!userDoc) {
    console.error("[approveApplication] ❌ user document not found");
    throw new Error("User document not found");
  }

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

  console.log("[approveApplication] application marked verified");

  await db().createDocument(
    DB_ID,
    NOTIFICATIONS_COLLECTION,
    ID.unique(),
    {
      accountid: application.userId, // ✅ match schema
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

  console.log("[approveApplication] ✅ SUCCESS");
  return { success: true };
}

/* =========================
   REJECT APPLICATION
========================= */
export async function rejectApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string,
) {
  console.log("[rejectApplication]", {
    applicationId,
    adminId,
    reviewNotes,
  });

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

  console.log("[rejectApplication] ✅ rejected");
  return { success: true };
}
