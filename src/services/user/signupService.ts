// signupUser.ts
import { ID } from "node-appwrite";
import { logError, logStep } from "../../services/lib/logger";

import { safeFormat } from "../../services/lib/models/user";
import { createAuthUser } from "./authService";
import { findByEmail } from "./gettersService";
import { toUserDocument } from "./user.mapper";
import type { SignupPayload } from "./user.types";
import { createUserRow, deleteUserRowByAccountId } from "./userService";

const SIGNUP_BONUS_CREDITS = 40;

export async function signupUser(payload: SignupPayload) {
  logStep("START signupUser", { email: payload.email });

  const normalizedEmail = payload.email.toLowerCase().trim();
  const accountId = payload.accountid ?? ID.unique();

  /* 1️⃣ Optional DB pre-check (soft) */
  const existing = await findByEmail(normalizedEmail).catch(() => null);
  if (existing) {
    const err: any = new Error("User already exists with this email");
    err.status = 409;
    throw err;
  }

  /* 2️⃣ Create Appwrite Auth user */
  try {
    await createAuthUser(accountId, normalizedEmail, payload.password);
  } catch (err) {
    logError("signupUser.authCreate", err);
    throw err;
  }

  /* 3️⃣ Build DB document (server-enforced role) */
  const document = toUserDocument(
    {
      ...payload,
      email: normalizedEmail,
      role: payload.role === "agent" ? "agent" : "user", // 🔒 enforce
    },
    accountId,
    SIGNUP_BONUS_CREDITS
  );

  /* 4️⃣ Create DB row (with rollback) */
  let createdRow;
  try {
    createdRow = await createUserRow(document);
  } catch (err) {
    logError("signupUser.createRow", err);

    // 🔥 Rollback auth user
    try {
      await deleteUserRowByAccountId(accountId);
    } catch {}

    throw err;
  }

  return {
    status: "SUCCESS",
    userId: accountId,
    profileId: createdRow.$id,
    profile: safeFormat(createdRow),
  };
}
