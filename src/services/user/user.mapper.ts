// user.mapper.ts
import { ID } from "node-appwrite";
import type { SignupPayload } from "./user.types";

export function toUserDocument(
  payload: SignupPayload,
  accountId: string,
  hashedPassword: string,
  credits: number
) {
  return {
    accountid: accountId,
    email: payload.email.toLowerCase(),

    firstName: payload.firstName,
    surname: payload.surname,

    role: payload.role ?? "user",
    status: payload.status ?? "Active",

    nationalId: payload.nationalId ?? null,
    bio: payload.bio ?? null,
    metadata: payload.metadata ?? [],

    country: payload.country ?? null,
    location: payload.location ?? null,
    dateOfBirth: payload.dateOfBirth ?? null,

    password: hashedPassword,
    phone: payload.phone ?? null,

    // ✅ SERVER-CONTROLLED FIELDS
    credits,
    lastLoginReward: new Date().toISOString(),
    createdAt: new Date().toISOString(),

    agentId: payload.role === "agent" ? ID.unique() : null,
  };
}
