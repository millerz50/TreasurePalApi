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

  /* 1️⃣ Optional DB pre-check */
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

  /* 3️⃣ Server-enforced roles */
  const roles: ("user" | "agent")[] = ["user"];

  if (payload.role === "agent") {
    roles.push("agent");
  }

  /* 4️⃣ Build DB document */
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
    status: payload.status ?? "Pending",
  },
  accountId,
  SIGNUP_BONUS_CREDITS
);


  /* 5️⃣ Create DB row (with rollback) */
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

  return {
    status: "SUCCESS",
    userId: accountId,
    profileId: createdRow.$id,
    profile: safeFormat(createdRow),
  };
}
