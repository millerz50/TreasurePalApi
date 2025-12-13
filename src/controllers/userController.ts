/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";

import {
  createUser,
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

function sanitizePhone(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  const normalized = s.replace(/^[\uFF0B]/, "+").replace(/[ \-\(\)]/g, "");
  return /^\+\d{1,15}$/.test(normalized) ? normalized : null;
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
    logStep("Saved phone locally", { userId, phone });
  } catch (err) {
    logError("savePhoneToExternalDB", err, { userId, phone });
    throw err;
  }
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
    } = req.body;

    if (!email || !password || !firstName || !surname) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    logStep("Signup request received", { email, firstName, surname, role });

    const exists = await findByEmail(email.toLowerCase());
    if (exists) return res.status(409).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    logStep("Password hashed");

    let avatarFileId: string | undefined;
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file) {
        const result = await uploadToAppwriteBucket(
          file.buffer,
          file.originalname
        );
        avatarFileId =
          result?.fileId ?? (typeof result === "string" ? result : undefined);
        logStep("Avatar uploaded", { avatarFileId });
      }
    } catch (err) {
      logError("avatarUpload failed", err, { email });
    }

    const agentId = role === "agent" ? randomUUID() : undefined;
    logStep("Generated agent ID if applicable", { agentId });

    // 👇 Controller just builds camelCase payload
    const servicePayload = {
      accountId: req.body.accountId,
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      surname,
      country,
      location,
      role,
      status: "Active",
      nationalId,
      bio: bio ?? undefined,
      avatarUrl: avatarFileId,
      dateOfBirth,
      agentId,
      phone: sanitizePhone(req.body.phone),
    };

    let user;
    try {
      // 👇 Service will normalize payload to schema keys
      user = await createUser(servicePayload);
      logStep("Created user in DB", user);
    } catch (err) {
      logError("createUser failed", err, { servicePayload });
      return res.status(500).json({ error: "Failed to create user" });
    }

    return res.status(201).json({ profile: user.profile });
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
      if (profile?.$id) phone = data[profile.$id];
    } catch (err) {
      if (DEBUG) console.error("Failed to read phone JSON:", err);
    }

    res.json({
      userId: profile.$id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      phone: phone ?? null,
      bio: profile.bio,
      firstName: profile.firstName ?? "",
      surname: profile.surname ?? "",
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
}

export async function editUser(req: Request, res: Response) {
  try {
    const targetId = req.params.id;
    const updates = { ...req.body };
    delete (updates as any).role;
    delete (updates as any).status;
    const updated = await svcUpdateUser(targetId, updates);
    res.json(updated);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Update failed" });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const targetId = req.params.id;
    await svcDeleteUser(targetId);
    res.status(204).send();
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Delete failed" });
  }
}

export async function getAllUsers(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit ?? 100);
    const result = await svcListUsers(limit);
    res.json(result);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const user = await svcGetUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const updates = req.body;
    const updated = await svcUpdateUser(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Update failed" });
  }
}

export async function setRole(req: Request, res: Response) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "role required" });
    const updated = await svcSetRole(req.params.id, role);
    res.json(updated);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Set role failed" });
  }
}

export async function setStatus(req: Request, res: Response) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });
    const updated = await svcSetStatus(req.params.id, status);
    res.json(updated);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Set status failed",
    });
  }
}

export async function getAgents(_req: Request, res: Response) {
  try {
    const agents = await svcListAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch agents",
    });
  }
}
