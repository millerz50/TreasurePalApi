import { Databases, Query } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";
import { logError, logStep } from "../../services/lib/logger";
import { safeFormat } from "../../services/lib/models/user";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = getEnv("APPWRITE_USERS_COLLECTION") ?? "users";

function db() {
  return new Databases(getClient());
}

export type SigninPayload = {
  email: string;
  password: string; // kept for API compatibility, NOT used here
  phone?: string;
};

export async function signinUser(payload: SigninPayload) {
  logStep("START signinUser", { email: payload.email });

  const normalizedEmail = payload.email.toLowerCase().trim();

  /* -----------------------------
     1️⃣ FETCH USER PROFILE ONLY
     (AUTH IS DONE ON FRONTEND)
  ------------------------------ */

  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("email", normalizedEmail),
  ]);

  if (res.total === 0) {
    const err: any = new Error("User profile not found");
    err.status = 404;
    throw err;
  }

  const user = res.documents[0];

  /* -----------------------------
     2️⃣ UPDATE LAST LOGIN + PHONE
  ------------------------------ */

  const updates: Record<string, any> = {
    lastLoginAt: new Date().toISOString(),
  };

  if (payload.phone && payload.phone !== user.phone) {
    updates.phone = payload.phone;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await db().updateDocument(DB_ID, USERS_COLLECTION, user.$id, updates);
      Object.assign(user, updates);
    } catch (err) {
      logError("signinUser.updateProfile", err);
    }
  }

  /* -----------------------------
     3️⃣ RETURN SAFE PROFILE ONLY
  ------------------------------ */

  return {
    status: "SUCCESS",
    profile: safeFormat(user),
  };
}
