// src/v2/services/user/signupService.ts
import { Client, ID, Storage } from "node-appwrite";
import { logError, logStep } from "../../services/lib/logger";

import { safeFormat } from "../../services/lib/models/user";
import { createAuthUser } from "./authService";
import { findByEmail } from "./gettersService";
import { toUserDocument } from "./user.mapper";
import type { SignupPayload, UserRole } from "./user.types";
import { createUserRow, getUserByAccountId } from "./userService";

import { databases } from "../../index"; // Appwrite client

const SIGNUP_BONUS_CREDITS = 40;

/**
 * Uploads an image to Appwrite storage bucket in Node.js
 */
async function uploadProfileImage(
  client: Client,
  bucketId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const storage = new Storage(client);

  try {
    logStep("Uploading profile image", { bucketId, filename, mimeType });

    const uploaded = await storage.createFile(
      bucketId,
      ID.unique(),
      buffer as any
    );

    logStep("Profile image uploaded", { fileId: uploaded.$id });
    return uploaded.$id;
  } catch (err) {
    logError("signupService.uploadProfileImage failed", err);
    throw new Error("Failed to upload profile image");
  }
}

/**
 * Signup a new user
 */
export async function signupUser(payload: SignupPayload) {
  logStep("START signupUser", { email: payload.email });

  if (!payload.email) throw new Error("Email is required");
  if (!payload.password) throw new Error("Password is required");

  const normalizedEmail = payload.email.toLowerCase().trim();
  const accountId = payload.accountid ?? ID.unique();

  // 1️⃣ Pre-check if user exists
  const existing = await findByEmail(normalizedEmail).catch(() => null);
  if (existing) {
    const err: any = new Error("User already exists with this email");
    err.status = 409;
    throw err;
  }

  // 2️⃣ Create Auth user
  try {
    logStep("Creating auth user", { accountId, email: normalizedEmail });
    await createAuthUser(accountId, normalizedEmail, payload.password);
    logStep("Auth user created", { accountId });
  } catch (err) {
    logError("signupService.authCreate failed", err);
    throw new Error("Failed to create auth user");
  }

  // 3️⃣ Server-enforced roles
  const roles: UserRole[] = ["user"];

  // 4️⃣ Profile image upload
  let profileImageId: string | undefined;
  if (payload.profileImage) {
    try {
      const { buffer, filename, mimeType } = payload.profileImage as {
        buffer: Buffer;
        filename: string;
        mimeType: string;
      };

      profileImageId = await uploadProfileImage(
        databases.client,
        process.env.APPWRITE_BUCKET_ID || "",
        buffer,
        filename,
        mimeType
      );
    } catch (err) {
      logError("signupService.profileImageUpload failed", err);
      // continue without profile image
    }
  }

  // 5️⃣ Build DB document
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

  // 6️⃣ Create DB row
  let createdRow;
  try {
    logStep("Creating DB row", { accountId });
    createdRow = await createUserRow(document);
    logStep("DB row created", { profileId: createdRow.$id });
  } catch (err) {
    logError("signupService.createRow failed", err);
    throw new Error("Failed to create user profile");
  }

  // 7️⃣ Return safe response
  const response = {
    status: "SUCCESS",
    userId: accountId,
    profileId: createdRow.$id,
    profile: safeFormat(createdRow),
  };

  logStep("signupUser completed", response);
  return response;
}
