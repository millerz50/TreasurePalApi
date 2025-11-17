// server/services/adminService.ts
import { hashPassword } from "../lib/utils/auth"; // adjust path if needed
import {
  findByEmail,
  getUserById,
  createUser as svcCreateUser,
  updateUser as svcUpdateUser,
} from "./userService";

const ALLOWED_ROLES = new Set(["user", "agent", "admin"]);

export async function createAdminAccount(payload: {
  firstName: string;
  surname: string;
  email: string;
  password?: string;
  accountId?: string | null;
}) {
  const email = String(payload.email).toLowerCase();

  // Prevent duplicate
  const existing = await findByEmail(email);
  if (existing) {
    throw new Error("A user already exists with that email");
  }

  // Hash password only if you plan to store it in users collection.
  // Prefer creating Appwrite Account separately and store only accountId in users doc.
  let hashedPassword: string | undefined = undefined;
  if (payload.password) {
    hashedPassword = await hashPassword(payload.password);
  }

  const userPayload: any = {
    accountId: payload.accountId ?? null,
    email,
    firstName: payload.firstName,
    surname: payload.surname,
    role: "admin",
    status: "active",
    emailVerified: false,
  };

  if (hashedPassword) userPayload.password = hashedPassword;

  const user = await svcCreateUser(userPayload);
  return user;
}

/**
 * Promote or change a user's role.
 * Only call from admin-protected endpoints.
 */
export async function setUserRole(targetUserId: string, role: string) {
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(
      `Invalid role. Allowed roles: ${Array.from(ALLOWED_ROLES).join(", ")}`
    );
  }

  const existing = await getUserById(targetUserId);
  if (!existing) throw new Error("User not found");

  // If demoting the last admin, you might want an extra guard (not implemented here)
  const updated = await svcUpdateUser(targetUserId, { role });
  return updated;
}

/**
 * Set user status (active, pending, suspended).
 * Only admins should call this via controller/middleware.
 */
export async function setUserStatus(targetUserId: string, status: string) {
  const allowed = new Set(["active", "pending", "suspended"]);
  if (!allowed.has(status))
    throw new Error(
      `Invalid status. Allowed: ${Array.from(allowed).join(", ")}`
    );
  const existing = await getUserById(targetUserId);
  if (!existing) throw new Error("User not found");
  const updated = await svcUpdateUser(targetUserId, { status });
  return updated;
}

export default {
  createAdminAccount,
  setUserRole,
  setUserStatus,
};
