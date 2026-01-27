import { Databases, Query, ID } from "node-appwrite";
import { getClient, getEnv } from "../../services/lib/env";
import { logError, logStep } from "../../services/lib/logger";
import { safeFormat } from "../../services/lib/models/user";

const DB_ID = getEnv("APPWRITE_DATABASE_ID")!;
const USERS_COLLECTION = getEnv("APPWRITE_USERS_COLLECTION") ?? "users";
const ACTIVITY_COLLECTION =
  getEnv("APPWRITE_ACTIVITY_COLLECTION") ?? "activity";

const SIGNIN_BONUS = 2;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function db() {
  return new Databases(getClient());
}

/* ============================
   TYPES
============================ */

export type SigninPayload = {
  email: string;
  password?: string; // NOT USED (auth already done by Appwrite)
  phone?: string;
};

/* ============================
   ACTIVITY MESSAGE GENERATOR
============================ */

function generateActivityMessage(params: {
  action: "signin_bonus";
  amount: number;
}) {
  switch (params.action) {
    case "signin_bonus":
      return `You received ${params.amount} credits for your daily sign-in reward.`;
    default:
      return "Account activity recorded.";
  }
}

/* ============================
   ACTIVITY LOGGER
============================ */

async function logActivity(payload: {
  actorId: string;
  actorRole?: string;
  action: "signin_bonus";
  amount?: number;
  refId?: string;
  refType?: string;
}) {
  try {
    await db().createDocument(DB_ID, ACTIVITY_COLLECTION, ID.unique(), {
      actorId: payload.actorId,
      actorRole: payload.actorRole ?? "user",
      action: payload.action,
      message: generateActivityMessage({
        action: payload.action,
        amount: payload.amount ?? 0,
      }),
      amount: payload.amount ?? null,
      refId: payload.refId ?? null,
      refType: payload.refType ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Activity logging must NEVER break signin
    logError("activity:log", err);
  }
}

/* ============================
   SIGN IN (PROFILE + BONUS)
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
     2️⃣ SIGN-IN BONUS CHECK
  ------------------------------ */

  const now = Date.now();
  const lastRewardTime = user.lastLoginReward
    ? new Date(user.lastLoginReward).getTime()
    : 0;

  const grantBonus = now - lastRewardTime >= COOLDOWN_MS;

  /* -----------------------------
     3️⃣ PREPARE UPDATES
  ------------------------------ */

  const updates: Record<string, any> = {
    lastLoginAt: new Date().toISOString(),
  };

  if (payload.phone && payload.phone !== user.phone) {
    updates.phone = payload.phone;
  }

  if (grantBonus) {
    updates.credits = (user.credits ?? 0) + SIGNIN_BONUS;
    updates.lastLoginReward = new Date().toISOString();
  }

  /* -----------------------------
     4️⃣ UPDATE USER DOCUMENT
  ------------------------------ */

  try {
    await db().updateDocument(DB_ID, USERS_COLLECTION, user.$id, updates);
    Object.assign(user, updates);
  } catch (err) {
    logError("signinUser:updateProfile", err);
  }

  /* -----------------------------
     5️⃣ LOG ACTIVITY (BONUS ONLY)
  ------------------------------ */

  if (grantBonus) {
    await logActivity({
      actorId: user.accountid,
      actorRole: user.roles?.includes("agent") ? "agent" : "user",
      action: "signin_bonus",
      amount: SIGNIN_BONUS,
      refId: user.$id,
      refType: "user",
    });
  }

  /* -----------------------------
     6️⃣ RETURN SAFE PROFILE
  ------------------------------ */

  return {
    status: "SUCCESS",
    bonusGranted: grantBonus,
    profile: safeFormat(user),
  };
}
