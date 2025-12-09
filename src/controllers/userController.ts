// server/controllers/userController.ts
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import sdk from "node-appwrite";

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

/**
 * Strict phone sanitizer: returns either a valid E.164 string (+digits up to 15) or null.
 */
function sanitizePhone(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  // Normalize fullwidth plus (U+FF0B) to ASCII plus and strip formatting
  const normalized = s.replace(/^[\uFF0B]/, "+").replace(/[ \-\(\)]/g, "");
  return /^\+\d{1,15}$/.test(normalized) ? normalized : null;
}

// Initialize Appwrite client (server-side)
const client = new sdk.Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT as string)
  .setProject(process.env.APPWRITE_PROJECT_ID as string)
  .setKey(process.env.APPWRITE_API_KEY as string);
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
      metadata = [],
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
      metadata?: unknown;
      country?: string;
      location?: string;
      dateOfBirth?: string;
      phone?: string;
    };

    if (!email || !password || !firstName || !surname) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (DEBUG) logDebug("signup request body", { body: req.body });

    const exists = await findByEmail(String(email).toLowerCase());
    if (exists) return res.status(409).json({ error: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Optional avatar upload
    let avatarFileId: string | undefined;
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file && typeof uploadToAppwriteBucket === "function") {
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
    let agentId: string | undefined;
    if (role === "agent") agentId = randomUUID();

    // Sanitize phone (E.164 format, e.g. +263771234567) but do NOT send to Appwrite
    const phone = sanitizePhone(incomingPhone);
    if (DEBUG) {
      logDebug("sanitized E.164 phone (kept local only)", {
        phone,
        charCodes: phone ? [...phone].map((c) => c.charCodeAt(0)) : null,
      });
    }

    // Build payload for user creation (exclude phone and metadata here)
    const servicePayload = {
      email: String(email).toLowerCase(),
      password: hashedPassword,
      firstName: String(firstName),
      surname: String(surname),
      country: country ?? undefined,
      location: location ?? undefined,
      role: role ?? "user",
      status: "Active",
      nationalId: nationalId ?? undefined,
      bio: bio ?? undefined,
      avatarUrl: avatarFileId ?? undefined,
      dateOfBirth: dateOfBirth ?? undefined,
      agentId: agentId ?? undefined,
      // metadata removed completely
    };

    if (DEBUG)
      logDebug(
        "servicePayload to createUser (no phone, no metadata sent to Appwrite)",
        {
          servicePayload: {
            ...servicePayload,
            password: "[REDACTED]",
          },
        }
      );

    // Create user in your service layer (createUser must NOT forward phone/metadata to Appwrite)
    const user = await createUser(servicePayload);

    // If you want to persist phone, save it in your own DB after user creation
    // Or call account.updatePhone(phone, password) with Appwrite SDK

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

    res.json({
      userId: profile.$id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      phone: profile.phone,
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
      err instanceof Error ? err.message : "Failed to fetch agents all";
    res.status(500).json({ error: message });
  }
}
