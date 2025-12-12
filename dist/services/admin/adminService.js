"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminAccount = createAdminAccount;
exports.setUserRole = setUserRole;
exports.setUserStatus = setUserStatus;
// server/services/adminService.ts
const auth_1 = require("../../lib/utils/auth"); // adjust path if needed
const userService_1 = require("../user/userService");
const ALLOWED_ROLES = new Set(["user", "agent", "admin"]);
async function createAdminAccount(payload) {
    const email = String(payload.email).toLowerCase();
    // Prevent duplicate
    const existing = await (0, userService_1.findByEmail)(email);
    if (existing) {
        throw new Error("A user already exists with that email");
    }
    // Hash password only if you plan to store it in users collection.
    // Prefer creating Appwrite Account separately and store only accountId in users doc.
    let hashedPassword = undefined;
    if (payload.password) {
        hashedPassword = await (0, auth_1.hashPassword)(payload.password);
    }
    const userPayload = {
        accountId: payload.accountId ?? null,
        email,
        firstName: payload.firstName,
        surname: payload.surname,
        role: "admin",
        status: "active",
        emailVerified: false,
    };
    if (hashedPassword)
        userPayload.password = hashedPassword;
    const user = await (0, userService_1.createUser)(userPayload);
    return user;
}
/**
 * Promote or change a user's role.
 * Only call from admin-protected endpoints.
 */
async function setUserRole(targetUserId, role) {
    if (!ALLOWED_ROLES.has(role)) {
        throw new Error(`Invalid role. Allowed roles: ${Array.from(ALLOWED_ROLES).join(", ")}`);
    }
    const existing = await (0, userService_1.getUserById)(targetUserId);
    if (!existing)
        throw new Error("User not found");
    // If demoting the last admin, you might want an extra guard (not implemented here)
    const updated = await (0, userService_1.updateUser)(targetUserId, { role });
    return updated;
}
/**
 * Set user status (active, pending, suspended).
 * Only admins should call this via controller/middleware.
 */
async function setUserStatus(targetUserId, status) {
    const allowed = new Set(["active", "pending", "suspended"]);
    if (!allowed.has(status))
        throw new Error(`Invalid status. Allowed: ${Array.from(allowed).join(", ")}`);
    const existing = await (0, userService_1.getUserById)(targetUserId);
    if (!existing)
        throw new Error("User not found");
    const updated = await (0, userService_1.updateUser)(targetUserId, { status });
    return updated;
}
exports.default = {
    createAdminAccount,
    setUserRole,
    setUserStatus,
};
