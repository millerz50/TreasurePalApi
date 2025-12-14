import { ID } from "node-appwrite";
import type { SignupPayload } from "./user.types";

export function toUserDocument(
  payload: SignupPayload,
  accountId: string,
  hashedPassword: string
) {
  return {
    // ✅ matches schema
    accountid: accountId,
    email: payload.email.toLowerCase(),

    // ✅ REQUIRED (case-sensitive)
    firstName: payload.firstName,
    surname: payload.surname,

    // ✅ enums / strings
    role: payload.role ?? "user",
    status: payload.status ?? "Active",

    // ✅ optional fields
    nationalId: payload.nationalId ?? null,
    bio: payload.bio ?? null,
    metadata: Array.isArray(payload.metadata) ? payload.metadata : [],

    dateOfBirth: payload.dateOfBirth ?? null,
    country: payload.country ?? null,
    location: payload.location ?? null,

    // ✅ auth-related
    password: hashedPassword,
    phone: payload.phone ?? null,

    // ✅ agent only
    agentId: payload.role === "agent" ? ID.unique() : null,
  };
}
