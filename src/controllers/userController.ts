// server/controllers/userController.ts
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import fs from "fs/promises";
import sdk from "node-appwrite";
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
import { logDebug, logError } from "./utils/logger";

const DEBUG = process.env.DEBUG === "true";

// Path to JSON file
const dbFile = path.join(__dirname, "phones.json");

/**
 * Strict phone sanitizer: returns either a valid E.164 string (+digits up to 15) or null.
 */
function sanitizePhone(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  const normalized = s.replace(/^[\uFF0B]/, "+").replace(/[ \-\(\)]/g, "");
  return /^\+\d{1,15}$/.test(normalized) ? normalized : null;
}

// Initialize Appwrite client (server-side)
const client = new sdk.Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT as string)
  .setProject(process.env.APPWRITE_PROJECT_ID as string)
  .setKey(process.env.APPWRITE_API_KEY as string);

/**
 * Save a phone number to a JSON file
 */
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
    if (DEBUG) console.log(`Saved phone for user ${userId}`);
  } catch (err) {
    console.error("Failed to save phone:", err);
    throw err;
  }
}

/* --------------------------
   Signup handler
--------------------------- */
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
      phone: incomingPhone,
    } = req.body as {
      email?: string;
      password?: string;
      firstName?: string;
      surname?: string;
      role?: string;
      nationalId?: string;
      bio?: string | null;
      country?: string;
      location?: string;
      dateOfBirth?: string;
      phone?: string;
    };

    if (!email || !password || !firstName || !surname) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (DEBUG) logDebug("signup request body", { body: req.body });

    // Check if user already exists
    const exists = await findByEmail(email.toLowerCase());
    if (exists) return res.status(409).json({ error: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Optional avatar upload
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
      }
    } catch (err) {
      logError("avatarUpload", err, { email });
    }

    // Generate agent ID if role is agent
    const agentId = role === "agent" ? randomUUID() : undefined;

    // Sanitize phone locally (do NOT send to Appwrite)
    const phone = sanitizePhone(incomingPhone);
    if (DEBUG) logDebug("sanitized E.164 phone (kept local only)", { phone });

    // Build payload for Appwrite (exclude phone)
    const servicePayload = {
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
    };

    // Create user in Appwrite
    const user = await createUser(servicePayload);

    if (phone && user.profile?.$id) {
      try {
        await savePhoneToExternalDB(user.profile.$id, phone);
      } catch (err) {
        logError("savePhoneToExternalDB", err, {
          userId: user.profile.$id,
          phone,
        });
      }
    }

    return res.status(201).json(user);
  } catch (err) {
    logError("signup", err, { body: req.body });
    const message = err instanceof Error ? err.message : "Signup failed";
    return res.status(400).json({ error: message });
  }
}

/* --------------------------
   Other handlers
--------------------------- */

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

    // Load phone from JSON DB

    let phone: string | undefined;

    try {
      const fileContent = await fs.readFile(dbFile, "utf-8");
      const data = JSON.parse(fileContent) as Record<string, string>;
      if (profile?.$id) {
        phone = data[profile.$id];
      }
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
      avatarFileId: profile.avatarFileId ?? null,
      firstName: profile.firstName ?? "",
      surname: profile.surname ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: message });
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
    const message = err instanceof Error ? err.message : "Update failed";
    res.status(400).json({ error: message });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const targetId = req.params.id;
    await svcDeleteUser(targetId);
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    res.status(400).json({ error: message });
  }
}

export async function getAllUsers(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit ?? 100);
    const result = await svcListUsers(limit);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: message });
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const user = await svcGetUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: message });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const updates = req.body;
    const updated = await svcUpdateUser(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    res.status(400).json({ error: message });
  }
}

export async function setRole(req: Request, res: Response) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "role required" });
    const updated = await svcSetRole(req.params.id, role);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Set role failed";
    res.status(400).json({ error: message });
  }
}

export async function setStatus(req: Request, res: Response) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });
    const updated = await svcSetStatus(req.params.id, status);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Set status failed";
    res.status(400).json({ error: message });
  }
}

export async function getAgents(_req: Request, res: Response) {
  try {
    const agents = await svcListAgents();
    res.json(agents);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch agents";
    res.status(500).json({ error: message });
  }
}
