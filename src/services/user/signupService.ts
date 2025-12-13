import bcrypt from "bcryptjs";
import { ID } from "node-appwrite";
import { logError, logStep } from "../../services/lib/logger";
import { safeFormat } from "../../services/lib/models/user";
import { createAuthUser } from "./authService";
import { findByEmail } from "./gettersService";
import { createUserRow } from "./userService";

export type SignupPayload = {
  accountId?: string;
  email: string;
  password: string;
  firstName: string;
  surname: string;
  phone?: string; // profile phone
  country?: string;
  location?: string;
  role?: string;
  status?: string;
  nationalId?: string;
  bio?: string;
  metadata?: any[];
  dateOfBirth?: string;
  authPhone?: string; // 👈 separate field for Auth phone
};

export async function signupUser(payload: SignupPayload) {
  logStep("START signupUser", { email: payload.email });
  const normalizedEmail = payload.email.toLowerCase().trim();
  const accountId = payload.accountId ?? ID.unique();

  // Check if user already exists
  const existing = await findByEmail(normalizedEmail).catch(() => null);
  if (existing) {
    const error: any = new Error("User already exists with this email.");
    error.status = 409;
    throw error;
  }

  // Create Appwrite Auth user (credentials + authPhone if supported)
  let authUser;
  try {
    authUser = await createAuthUser(
      accountId,
      normalizedEmail,
      payload.password
    );
    // If SDK supports phone update, set authPhone separately
    if (payload.authPhone) {
      // @ts-ignore
      if (typeof authUser.updatePhone === "function") {
        // @ts-ignore
        await authUser.updatePhone(payload.authPhone);
      }
    }
  } catch (err) {
    logError("signupUser.authCreate", err);
    throw err;
  }

  // Hash password for DB only
  const hashedPassword = await bcrypt.hash(payload.password, 10);

  // Create DB row (profile metadata + hashed password + profile phone)
  const rowPayload = {
    accountid: accountId,
    email: normalizedEmail,
    firstName: payload.firstName,
    surname: payload.surname,
    country: payload.country ?? null,
    location: payload.location ?? null,
    role: payload.role ?? "user",
    status: payload.status ?? "Active",
    nationalId: payload.nationalId ?? null,
    bio: payload.bio ?? null,
    metadata: Array.isArray(payload.metadata) ? payload.metadata : [],
    dateOfBirth: payload.dateOfBirth ?? null,
    password: hashedPassword, // 👈 hashed password only
    phone: payload.phone ?? null, // 👈 profile phone only
    agentId: payload.role === "agent" ? ID.unique() : null,
  };

  let createdRow;
  try {
    createdRow = await createUserRow(rowPayload);
  } catch (err) {
    logError("signupUser.createRow", err);
    throw err;
  }

  return {
    status: "SUCCESS",
    userId: accountId,
    authUser,
    profileId: createdRow.$id,
    profile: safeFormat(createdRow),
  };
}
