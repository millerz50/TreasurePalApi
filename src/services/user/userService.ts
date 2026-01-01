// services/users.ts
import { Databases, ID, Permission, Query, Role } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = "users";
const AGENT_APPLICATIONS_COLLECTION = "agent_profiles"; // new collection for applications
const NOTIFICATIONS_COLLECTION = "notifications"; // optional notifications collection

type UserRole = "user" | "agent" | "admin";
type UserStatus = "Not Verified" | "Pending" | "Active" | "Suspended";

function db() {
  return new Databases(getClient());
}

/* ============================
   CREATE
============================ */

/**
 * Create a user document in the users collection.
 * Permissions: owner (user accountid) + admin team can read/update; only admin can delete.
 */
export async function createUserRow(payload: Record<string, any>) {
  const userId = payload.accountid;

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
   AGENT APPLICATIONS (NEW)
   - Applications are created when a user applies to become an agent.
   - Admins review applications and call approveApplication to grant agent role.
   - Applications are readable by admin team only.
============================ */

/**
 * Submit an agent application.
 * Stores application in AGENT_APPLICATIONS_COLLECTION with admin-readable permissions.
 */
export async function submitAgentApplication(payload: {
  userId: string; // required by Appwrite
  licenseNumber?: string | null;
  agencyId?: string | null;
  rating?: number | null;
  verified?: boolean | null;
}) {
  if (!payload || !payload.userId) {
    throw new Error("userId is required to submit an application");
  }

  const doc = {
    userId: payload.userId,
    licenseNumber: payload.licenseNumber ?? null,
    agencyId: payload.agencyId ?? null,
    rating: payload.rating ?? null,
    verified: payload.verified ?? null,
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

/**
 * List pending agent applications (admin use).
 */
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

/**
 * 🔒 ADMIN ONLY — replaces all roles
 * (use sparingly)
 */
export async function setRoles(documentId: string, roles: UserRole[]) {
  if (!roles.includes("user")) {
    roles.push("user"); // user is mandatory
  }

  return updateUser(documentId, {
    roles: Array.from(new Set(roles)),
  });
}

/**
 * ✅ OPTION C — APPROVE AGENT (internal helper)
 * Adds agent role, keeps others
 */
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

/**
 * Approve an application (admin action).
 * - applicationId: id of application document
 * - adminId: account id or admin identifier performing approval (for audit)
 * - reviewNotes: optional notes
 *
 * Steps:
 * 1. Fetch application
 * 2. Find user document by accountid
 * 3. Call approveAgent(userDocumentId)
 * 4. Update application status to 'approved' and record reviewer
 * 5. Optionally create a notification document for the user (admins only)
 */
export async function approveApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string
) {
  // fetch application
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");

  if (application.status === "approved") {
    throw new Error("Application already approved");
  }

  const accountid = application.accountid;
  if (!accountid) throw new Error("Application missing accountid");

  // find user document
  const userDoc = await getUserByAccountId(accountid);
  if (!userDoc) {
    throw new Error("User document not found for accountid");
  }

  // approve user (adds agent role)
  await approveAgent(userDoc.$id);

  // update application record
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

  // optional: create a notification for the user (admins can read/write)
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
        // user can read their own notification
        Permission.read(Role.user(accountid)),
        Permission.update(Role.user(accountid)),
        Permission.delete(Role.team("admin")),
        Permission.read(Role.team("admin")),
      ]
    );
  } catch (err) {
    // non-fatal: notification creation failed; log and continue
    console.warn("Failed to create notification for approved agent:", err);
  }

  return { success: true, applicationId, userDocumentId: userDoc.$id };
}

/**
 * Reject an application (admin action).
 * - marks application as rejected and records reviewer and notes
 */
export async function rejectApplication(
  applicationId: string,
  adminId: string,
  reviewNotes?: string
) {
  const application = await getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");

  if (application.status === "approved") {
    throw new Error("Cannot reject an already approved application");
  }

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

  // optional: notify user of rejection
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

/**
 * ✅ Promote to admin (optional helper)
 */
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
