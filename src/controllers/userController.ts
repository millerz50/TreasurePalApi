// server/controllers/userController.ts
import { Request, Response } from "express";
import { uploadToAppwriteBucket } from "../services/storageService";
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
} from "../services/userService";

// 🆕 Signup handled by server: creates Appwrite auth user + profile row
export async function signup(req: Request, res: Response) {
  try {
    const {
      email,
      password,
      firstName,
      surname,
      role = "user",
      phone, // ✅ just pass through, no validation
      nationalId,
      bio,
      metadata,
    } = req.body;

    if (!email || !password || !firstName || !surname) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const exists = await findByEmail(String(email).toLowerCase());
    if (exists) return res.status(409).json({ error: "User already exists" });

    let avatarFileId: string | undefined;
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (file) {
      const result = await uploadToAppwriteBucket(
        file.buffer,
        file.originalname
      );
      avatarFileId =
        result?.fileId ?? (typeof result === "string" ? result : undefined);
    }

    const payload = {
      email: String(email).toLowerCase(),
      password: String(password),
      firstName,
      surname,
      role,
      phone, // ✅ passed directly
      nationalId,
      bio,
      avatarFileId,
      metadata,
      status: "Active",
    };

    const user = await createUser(payload);
    res.status(201).json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    res.status(400).json({ error: message });
  }
}

// 🔑 Login is client-side via Appwrite SDK
export async function loginUser(_req: Request, res: Response) {
  res
    .status(501)
    .json({ error: "Login handled by Appwrite Accounts; use client SDK" });
}

// 👤 Current user profile based on Appwrite accountId (from middleware)
export async function getUserProfile(req: Request, res: Response) {
  try {
    const accountId = (req as any).accountId;
    if (!accountId) return res.status(401).json({ error: "Unauthorized" });

    const profile = await getUserByAccountId(accountId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: message });
  }
}

// ✏️ Edit user (excluding role/status)
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

// ❌ Delete user
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

// 📋 List all users
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

// 🔎 Get user by ID
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

// ✏️ Update user
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

// 🔧 Set role
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

// 🔧 Set status
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

// 👥 List agents
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
