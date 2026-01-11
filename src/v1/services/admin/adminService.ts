// server/services/adminService.ts

import { hashPassword } from "../../lib/utils/auth";
import {
  findByEmail,
  getUserById,
  listUsers,
  createUserRow as svcCreateUser,
  updateUser as svcUpdateUser,
} from "../user/userService";

/* ----------------------------------
   CONSTANTS
----------------------------------- */
const ALLOWED_ROLES = new Set(["user", "agent", "admin"]);
const ALLOWED_STATUS = new Set([
  "Not Verified",
  "Pending",
  "Active",
  "Suspended",
]);

/* ----------------------------------
   CREATE ADMIN ACCOUNT
----------------------------------- */
export async function createAdminAccount(payload: {
  firstName: string;
  surname: string;
  email: string;
  password?: string;
  accountId?: string | null;
}) {
  const email = payload.email.toLowerCase();

  // Prevent duplicate users
  const existing = await findByEmail(email);
  if (existing) {
    throw new Error("A user already exists with that email");
  }

  // Optional password hashing (only if you store passwords in DB)
  let hashedPassword: string | undefined;
  if (payload.password) {
    hashedPassword = await hashPassword(payload.password);
  }

  const userPayload = {
    accountId: payload.accountId ?? null,
    email,
    firstName: payload.firstName,
    surname: payload.surname,

    // ✅ CORRECT SYSTEM
    roles: ["admin"],
    status: "Active" as const,
    emailVerified: false,

    ...(hashedPassword ? { password: hashedPassword } : {}),
  };

  const user = await svcCreateUser(userPayload);
  return user;
}

/* ----------------------------------
   SET USER ROLE (ADMIN ONLY)
----------------------------------- */
export async function setUserRole(
  targetUserId: string,
  role: "user" | "agent" | "admin"
) {
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(
      `Invalid role. Allowed roles: ${Array.from(ALLOWED_ROLES).join(", ")}`
    );
  }

  const existing = await getUserById(targetUserId);
  if (!existing) throw new Error("User not found");

  const currentRoles: string[] = Array.isArray(existing.roles)
    ? existing.roles
    : [];

  // 🛑 Prevent removing the last admin
  if (role !== "admin" && currentRoles.includes("admin")) {
    const allUsers = await listUsers();
    const adminCount = allUsers.filter(
      (u) => Array.isArray(u.roles) && u.roles.includes("admin")
    ).length;

    if (adminCount <= 1) {
      throw new Error("Cannot remove the last admin");
    }
  }

  // ✅ Replace roles with single primary role
  const updated = await svcUpdateUser(targetUserId, {
    roles: [role],
  });

  return updated;
}

/* ----------------------------------
   SET USER STATUS (ADMIN ONLY)
----------------------------------- */
export async function setUserStatus(
  targetUserId: string,
  status: "Not Verified" | "Pending" | "Active" | "Suspended"
) {
  if (!ALLOWED_STATUS.has(status)) {
    throw new Error(
      `Invalid status. Allowed: ${Array.from(ALLOWED_STATUS).join(", ")}`
    );
  }

  const existing = await getUserById(targetUserId);
  if (!existing) throw new Error("User not found");

  const updated = await svcUpdateUser(targetUserId, { status });
  return updated;
}

/* ----------------------------------
   EXPORT
----------------------------------- */
export default {
  createAdminAccount,
  setUserRole,
  setUserStatus,
};
