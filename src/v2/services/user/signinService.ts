import { Databases, Query } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";
import { logError, logStep } from "../../services/lib/logger";
import { safeFormat } from "../../services/lib/models/user";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = getEnv("APPWRITE_USERS_COLLECTION") ?? "users";

function db() {
  return new Databases(getClient());
}

/* ============================
   TYPES
============================ */

export type SigninPayload = {
  email: string;
  password?: string; // kept for API compatibility (NOT USED)
  phone?: string;
};

/* ============================
   SIGN IN (PROFILE ONLY)
   ⚠️ AUTH IS DONE VIA APPWRITE
============================ */

export async function signinUser(payload: SigninPayload) {
  logStep("signinUser:start", { email: payload.email });

  if (!payload.email) {
    const err: any = new Error("Email is required");
    err.status = 400;
    throw err;
  }

  const normalizedEmail = payload.email.toLowerCase().trim();

  /* -----------------------------
     1️⃣ FETCH USER PROFILE
  ------------------------------ */

  const res = await db().listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("email", normalizedEmail),
    Query.limit(1),
  ]);

  if (res.total === 0) {
    const err: any = new Error("User profile not found");
    err.status = 404;
    throw err;
  }

  const user = res.documents[0];

  /* -----------------------------
     2️⃣ UPDATE LAST LOGIN / PHONE
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
      logError("signinUser:updateProfile", err);
    }
  }

  /* -----------------------------
     3️⃣ RETURN SAFE PROFILE
  ------------------------------ */

  return {
    status: "SUCCESS",
    profile: safeFormat(user),
  };
}
