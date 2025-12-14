import { ID } from "node-appwrite";
import type { SignupPayload } from "./user.types";

export function toUserDocument(
  payload: SignupPayload,
  accountId: string,
  hashedPassword: string
) {
  return {
    accountid: accountId,
    email: payload.email.toLowerCase(),

    firstname: payload.firstName,
    surname: payload.surname,

    role: payload.role ?? "user",
    status: payload.status ?? "Active",

    nationalid: payload.nationalId ?? null,
    bio: payload.bio ?? null,
    metadata: Array.isArray(payload.metadata) ? payload.metadata : [],

    dateofbirth: payload.dateOfBirth ?? null,
    country: payload.country ?? null,
    location: payload.location ?? null,

    password: hashedPassword,
    phone: payload.phone ?? null,

    agentid: payload.role === "agent" ? ID.unique() : null,
  };
}
