// signupUser.ts
import { ID } from "node-appwrite";
import { logError, logStep } from "../../services/lib/logger";

import { safeFormat } from "../../services/lib/models/user";
import { createAuthUser } from "./authService";
import { findByEmail } from "./gettersService";
import { toUserDocument } from "./user.mapper";
import type { SignupPayload } from "./user.types";
import { createUserRow, deleteUserRowByAccountId } from "./userService";

/**
 * System constants
 */
const SIGNUP_BONUS_CREDITS = 40;

/**
 * Allowed roles in the system
 * (users may hold multiple roles, but signup is restricted)
 */
type UserRole = "user" | "agent" | "admin";

export async function signupUser(payload: SignupPayload) {
  logStep("START signupUser", { email: payload.email });

  /* =========================
     0️⃣ VALIDATION
  ========================= */

  if (!payload.email) {
    throw new Error("Email is required");
  }

  if (!payload.password) {
    throw new Error("Password is required");
  }

  const normalizedEmail = payload.email.toLowerCase().trim();
  const accountId = payload.accountid ?? ID.unique();

  /* =========================
     1️⃣ PRE-CHECK
  ========================= */

  const existing = await findByEmail(normalizedEmail).catch(() => null);
  if (existing) {
    const err: any = new Error("User already exists with this email");
    err.status = 409;
    throw err;
  }

  /* =========================
     2️⃣ CREATE AUTH USER
  ========================= */

  try {
    await createAuthUser(accountId, normalizedEmail, payload.password);
  } catch (err) {
    logError("signupUser.authCreate", err);
    throw err;
  }

  /* =========================
     3️⃣ SERVER-ENFORCED ROLES
     🔒 ALWAYS START AS USER
  ========================= */

  const roles: UserRole[] = ["user"];

  /* =========================
     4️⃣ BUILD DB DOCUMENT
     (SCHEMA-SAFE)
  ========================= */

  const document = toUserDocument(
    {
      email: normalizedEmail,
      firstName: payload.firstName,
      surname: payload.surname,

      phone: payload.phone,
      country: payload.country,
      location: payload.location,
      dateOfBirth: payload.dateOfBirth,

      roles,
      status: "Pending", // admin must approve promotions
    },
    accountId,
    SIGNUP_BONUS_CREDITS
  );

  /* =========================
     5️⃣ CREATE DB ROW
     (WITH ROLLBACK)
  ========================= */

  let createdRow;
  try {
    createdRow = await createUserRow(document);
  } catch (err) {
    logError("signupUser.createRow", err);

    // 🔥 Roll back auth user if DB write fails
    try {
      await deleteUserRowByAccountId(accountId);
    } catch {}

    throw err;
  }

  /* =========================
     6️⃣ RETURN SAFE RESPONSE
  ========================= */

  return {
    status: "SUCCESS",
    userId: accountId,
    profileId: createdRow.$id,
    profile: safeFormat(createdRow),
  };
}
