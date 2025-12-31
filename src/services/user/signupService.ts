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
): Promise<string> {
  const storage = new Storage(client);

  // Normalize Blob into File if needed (browser context)
  const normalizedFile =
    file instanceof File
      ? file
      : new File([file], `upload-${Date.now()}.png`, { type: file.type });

  try {
    logStep("Uploading profile image", { bucketId });
    const uploaded = await storage.createFile(
      bucketId,
      ID.unique(),
      normalizedFile
    );
    logStep("Profile image uploaded", { fileId: uploaded.$id });
    return uploaded.$id;
  } catch (err) {
    logError("signupUser.uploadProfileImage failed", err);
    throw new Error("Failed to upload profile image");
  }
}

export async function signupUser(payload: SignupPayload) {
  logStep("START signupUser", { email: payload.email });

  /* =========================
     0️⃣ VALIDATION
  ========================= */
  if (!payload.email) {
    logError("signupUser.validation", "Missing email");
    throw new Error("Email is required");
  }
  if (!payload.password) {
    logError("signupUser.validation", "Missing password");
    throw new Error("Password is required");
  }

  const normalizedEmail = payload.email.toLowerCase().trim();
  const accountId = payload.accountid ?? ID.unique();

  /* =========================
     1️⃣ PRE-CHECK
  ========================= */
  try {
    const existing = await findByEmail(normalizedEmail).catch(() => null);
    if (existing) {
      logError("signupUser.preCheck", "Duplicate email", {
        email: normalizedEmail,
      });
      const err: any = new Error("User already exists with this email");
      err.status = 409;
      throw err;
    }
  } catch (err) {
    logError("signupUser.preCheck failed", err);
    throw err;
  }

  /* =========================
     2️⃣ CREATE AUTH USER
  ========================= */
  try {
    logStep("Creating auth user", { accountId, email: normalizedEmail });
    await createAuthUser(accountId, normalizedEmail, payload.password);
    logStep("Auth user created", { accountId });
  } catch (err) {
    logError("signupUser.authCreate failed", err);
    throw new Error("Failed to create auth user");
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
    try {
      profileImageId = await uploadProfileImage(
        databases.client,
        process.env.APPWRITE_BUCKET_ID || "",
        payload.profileImage
      );
    } catch (err) {
      logError("signupUser.profileImageUpload failed", err);
      // continue without profile image
    }
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
      profileImageId,
    },
    accountId,
    SIGNUP_BONUS_CREDITS
  );

  /* =========================
     5️⃣ CREATE DB ROW
  ========================= */
  let createdRow;
  try {
    logStep("Creating DB row", { accountId });
    createdRow = await createUserRow(document);
    logStep("DB row created", { profileId: createdRow.$id });
  } catch (err) {
    logError("signupUser.createRow failed", err);
    // 🔥 Roll back auth user if DB write fails
    try {
      await deleteUserRowByAccountId(accountId);
      logStep("Rolled back auth user", { accountId });
    } catch (rollbackErr) {
      logError("signupUser.rollback failed", rollbackErr);
    }
    throw new Error("Failed to create user profile");
  }

  /* =========================
     6️⃣ RETURN SAFE RESPONSE
  ========================= */
  const response = {
    status: "SUCCESS",
    userId: accountId,
    profileId: createdRow.$id,
    profile: safeFormat(createdRow),
  };

  logStep("signupUser completed", response);
  return response;
}
