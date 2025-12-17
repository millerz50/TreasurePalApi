import bcrypt from "bcryptjs";
import { ID } from "node-appwrite";
import { logError, logStep } from "../../services/lib/logger";
import { safeFormat } from "../../services/lib/models/user";

import { createAuthUser } from "./authService";
import { findByEmail } from "./gettersService";
import { toUserDocument } from "./user.mapper";
import type { SignupPayload } from "./user.types";
import { createUserRow } from "./userService";

const SIGNUP_BONUS_CREDITS = 40;

export async function signupUser(payload: SignupPayload) {
  logStep("START signupUser", { email: payload.email });

  const normalizedEmail = payload.email.toLowerCase().trim();
  const accountId = payload.accountid ?? ID.unique();

  /* ----------------------------------
     1️⃣ Check existing user
  ----------------------------------- */
  const existing = await findByEmail(normalizedEmail).catch(() => null);
  if (existing) {
    const err: any = new Error("User already exists with this email");
    err.status = 409;
    throw err;
  }

  /* ----------------------------------
     2️⃣ Create Appwrite Auth user
  ----------------------------------- */
  let authUser;
  try {
    authUser = await createAuthUser(
      accountId,
      normalizedEmail,
      payload.password
    );

    if (
      payload.authPhone &&
      typeof (authUser as any).updatePhone === "function"
    ) {
      await (authUser as any).updatePhone(payload.authPhone);
    }
  } catch (err) {
    logError("signupUser.authCreate", err);
    throw err;
  }

  /* ----------------------------------
     3️⃣ Hash password
  ----------------------------------- */
  const hashedPassword = await bcrypt.hash(payload.password, 10);

  /* ----------------------------------
     4️⃣ Build DB document (CORRECT)
  ----------------------------------- */
  const document = toUserDocument(
    {
      ...payload,
      email: normalizedEmail, // ✔ still valid SignupPayload
    },
    accountId,
    hashedPassword,
    SIGNUP_BONUS_CREDITS // ✔ server-controlled
  );

  /* ----------------------------------
     5️⃣ Create DB row
  ----------------------------------- */
  let createdRow;
  try {
    createdRow = await createUserRow(document);
  } catch (err) {
    logError("signupUser.createRow", err);
    throw err;
  }

  /* ----------------------------------
     6️⃣ Return response
  ----------------------------------- */
  return {
    status: "SUCCESS",
    userId: accountId,
    authUser,
    profileId: createdRow.$id,
    profile: safeFormat(createdRow),
  };
}
