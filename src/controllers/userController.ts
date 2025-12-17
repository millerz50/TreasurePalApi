/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";

import { signupUser } from "../services/user/signupService";
import {
  findByEmail,
  getUserByAccountId,
  deleteUser as svcDeleteUser,
  getUserById as svcGetUserById,
  listAgents as svcListAgents,
  listUsers as svcListUsers,
  setRole as svcSetRole,
  setStatus as svcSetStatus,
  updateUser as svcUpdateUser,
} from "../services/user/userService";

import { uploadToAppwriteBucket } from "../services/storage/storageService";
import { logError } from "./utils/logger";

const DEBUG = process.env.DEBUG === "true";
const dbFile = path.join(__dirname, "phones.json");

// ----------------------------
// Utils
// ----------------------------
function logStep(step: string, data?: any) {
  if (DEBUG) console.log(`=== STEP: ${step} ===`, data ?? "");
}

function sanitizePhone(value: unknown): string | undefined {
  if (!value) return undefined;
  const s = String(value).trim();
  const normalized = s.replace(/^[\uFF0B]/, "+").replace(/[ \-\(\)]/g, "");
  return /^\+\d{1,15}$/.test(normalized) ? normalized : undefined;
}

async function savePhoneToExternalDB(userId: string, phone: string) {
  try {
    let data: Record<string, string> = {};
    try {
      const fileContent = await fs.readFile(dbFile, "utf-8");
      data = JSON.parse(fileContent);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    data[userId] = phone;
    await fs.writeFile(dbFile, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    logError("savePhoneToExternalDB", err, { userId, phone });
  }
}

// ----------------------------
// Payload Mapper
// ----------------------------
function toPublicUserPayload(profile: any, phone?: string) {
  return {
    userId: profile.$id,
    email: profile.email,
    firstName: profile.firstName ?? "",
    surname: profile.surname ?? "",
    role: profile.role ?? "user",
    status: profile.status ?? "Not Verified",
    accountid: profile.accountid,
    phone: phone ?? profile.phone ?? undefined,
    bio: profile.bio ?? undefined,
    nationalId: profile.nationalId ?? undefined,
    country: profile.country ?? undefined,
    location: profile.location ?? undefined,
    dateOfBirth: profile.dateOfBirth ?? undefined,
    agentId: profile.agentId ?? undefined,
    credits: typeof profile.credits === "number" ? profile.credits : 0,
    lastCreditAction: profile.lastCreditAction ?? undefined,
    lastLoginReward: profile.lastLoginReward ?? undefined,
    $createdAt: profile.$createdAt,
    $updatedAt: profile.$updatedAt,
  };
}

// ----------------------------
// Signup handler
// ----------------------------
export async function signup(req: Request, res: Response) {
  try {
    const {
      email,
      password,
      firstName,
      surname,
      role = "user",
      nationalId,
      bio,
      country,
      location,
      dateOfBirth,
      phone,
    } = req.body;

    if (!email || !password || !firstName || !surname) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    logStep("Signup request received", { email, role });

    const exists = await findByEmail(email.toLowerCase());
    if (exists) {
      return res.status(409).json({ error: "User already exists" });
    }

    let avatarUrl: string | undefined;
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file) {
        const result = await uploadToAppwriteBucket(
          file.buffer,
          file.originalname
        );
        avatarUrl =
          result?.fileId ?? (typeof result === "string" ? result : undefined);
      }
    } catch (err) {
      logError("avatarUpload failed", err, { email });
    }

    const signupPayload = {
      email: email.toLowerCase(),
      password,
      firstName,
      surname,
      role,
      nationalId,
      bio,
      country,
      location,
      dateOfBirth,
      phone: sanitizePhone(phone),
      avatarUrl,
    };

    const result = await signupUser(signupPayload);

    if (result?.profile?.$id && signupPayload.phone) {
      await savePhoneToExternalDB(result.profile.$id, signupPayload.phone);
    }

    return res.status(201).json({
      profile: result.profile,
    });
  } catch (err) {
    logError("signup handler failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ----------------------------
// Other controllers
// ----------------------------
export async function loginUser(_req: Request, res: Response) {
  res
    .status(501)
    .json({ error: "Login handled by Appwrite Accounts; use client SDK" });
}

export async function getUserProfile(req: Request, res: Response) {
  try {
    const accountId = (req as any).accountId;
    if (!accountId) return res.status(401).json({ error: "Unauthorized" });

    const profile = await getUserByAccountId(accountId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    let phone: string | undefined;
    try {
      const fileContent = await fs.readFile(dbFile, "utf-8");
      const data = JSON.parse(fileContent) as Record<string, string>;
      if (profile.$id) phone = data[profile.$id];
    } catch {}

    res.json(toPublicUserPayload(profile, phone));
  } catch (err) {
    logError("getUserProfile failed", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function editUser(req: Request, res: Response) {
  try {
    const updates = { ...req.body };
    delete updates.role;
    delete updates.status;
    const updated = await svcUpdateUser(req.params.id, updates);
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Update failed" });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    await svcDeleteUser(req.params.id);
    res.status(204).send();
  } catch {
    res.status(400).json({ error: "Delete failed" });
  }
}

export async function getAllUsers(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit ?? 100);
    res.json(await svcListUsers(limit));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const user = await svcGetUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    res.json(await svcUpdateUser(req.params.id, req.body));
  } catch {
    res.status(400).json({ error: "Update failed" });
  }
}

export async function setRole(req: Request, res: Response) {
  try {
    res.json(await svcSetRole(req.params.id, req.body.role));
  } catch {
    res.status(400).json({ error: "Set role failed" });
  }
}

export async function setStatus(req: Request, res: Response) {
  try {
    res.json(await svcSetStatus(req.params.id, req.body.status));
  } catch {
    res.status(400).json({ error: "Set status failed" });
  }
}

export async function getAgents(_req: Request, res: Response) {
  try {
    res.json(await svcListAgents());
  } catch {
    res.status(500).json({ error: "Failed to fetch agents" });
  }
}
