// user.mapper.ts
import { ID } from "node-appwrite"; // ✅ REQUIRED
import type { SignupPayload, UserRole } from "./user.types";

export function toUserDocument(
  payload: SignupPayload,
  accountId: string,
  credits: number
) {
  // 🔐 Enforce allowed roles at signup
  const role: UserRole = payload.role === "agent" ? "agent" : "user";

  return {
    accountid: accountId,
    email: payload.email.toLowerCase(),

    firstName: payload.firstName,
    surname: payload.surname,

    // 🔑 Role system
    role,
    roles: [role], // ✅ for guards

    status: "Active",

    phone: payload.phone ?? null,
    country: payload.country ?? null,
    location: payload.location ?? null,

    credits,
    lastLoginReward: new Date().toISOString(),

    // Agent-only field
    agentId: role === "agent" ? ID.unique() : null,
  };
}
