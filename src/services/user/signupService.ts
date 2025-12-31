// signupUser.ts
import { Client, ID, Storage } from "node-appwrite";
import { logError, logStep } from "../../services/lib/logger";

import { safeFormat } from "../../services/lib/models/user";
import { createAuthUser } from "./authService";
import { findByEmail } from "./gettersService";
import { toUserDocument } from "./user.mapper";
import type { SignupPayload } from "./user.types";
import { createUserRow, deleteUserRowByAccountId } from "./userService";

// Import the Appwrite client you already configured in index.ts
import { databases } from "../../index"; // adjust path if needed

/**
 * System constants
 */
const SIGNUP_BONUS_CREDITS = 40;

/**
 * Allowed roles in the system
 */
type UserRole = "user" | "agent" | "admin";

/**
 * Uploads an image to Appwrite storage bucket
 * Accepts File or Blob, normalizes to File
 */
async function uploadProfileImage(
  client: Client,
  bucketId: string,
  file: File | Blob
) {
  const storage = new Storage(client);

  // Normalize Blob into File if needed
  const normalizedFile =
    file instanceof File
      ? file
      : new File([file], `upload-${Date.now()}.png`, { type: file.type });

  try {
    const uploaded = await storage.createFile(
      bucketId,
      ID.unique(),
      normalizedFile
    );
    return uploaded.$id; // return file ID
  } catch (err) {
    logError("signupUser.uploadProfileImage", err);
    throw err;
  }
}

export async function signupUser(payload: SignupPayload) {
  logStep("START signupUser", { email: payload.email });

  /* =========================
     0️⃣ VALIDATION
  ========================= */
  if (!payload.email) throw new Error("Email is required");
  if (!payload.password) throw new Error("Password is required");

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
  ========================= */
  const roles: UserRole[] = ["user"];

  /* =========================
     4️⃣ BUILD DB DOCUMENT
  ========================= */
  let profileImageId: string | undefined;

  if (payload.profileImage) {
    profileImageId = await uploadProfileImage(
      databases.client, // reuse your Appwrite client
      process.env.APPWRITE_BUCKET_ID || "", // bucket ID from env
      payload.profileImage
    );
  }

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
      status: "Pending",
      profileImageId, // store file ID reference
    },
    accountId,
    SIGNUP_BONUS_CREDITS
  );

  /* =========================
     5️⃣ CREATE DB ROW
  ========================= */
  let createdRow;
  try {
    createdRow = await createUserRow(document);
  } catch (err) {
    logError("signupUser.createRow", err);
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
