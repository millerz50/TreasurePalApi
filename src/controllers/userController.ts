import { Request, Response } from "express";
import { uploadAvatar } from "../services/storageService";
import {
  createUser,
  findByEmail,
  deleteUser as svcDeleteUser,
  getUserById as svcGetUserById,
  listUsers as svcListUsers,
  setRole as svcSetRole,
  setStatus as svcSetStatus,
  updateUser as svcUpdateUser,
} from "../services/userService";

export async function signup(req: Request, res: Response) {
  try {
    const {
      accountId,
      email,
      firstName,
      surname,
      role = "user",
      ...rest
    } = req.body;
    if (!accountId || !email) {
      return res.status(400).json({ error: "accountId and email required" });
    }

    const exists = await findByEmail(String(email).toLowerCase());
    if (exists) return res.status(409).json({ error: "User already exists" });

    let avatarFileId: string | undefined;
    const file = (req as any).file;
    if (file) {
      avatarFileId = await uploadAvatar(file);
    }

    const payload = {
      accountId,
      email: String(email).toLowerCase(),
      firstName,
      surname,
      role,
      status: "active",
      avatarFileId,
      ...rest,
    };

    const user = await createUser(payload);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function loginUser(_req: Request, res: Response) {
  res
    .status(501)
    .json({ error: "Login handled by Appwrite Accounts; use client SDK" });
}

export async function getUserProfile(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(404).json({ error: "Profile not found" });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function editUser(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const updates = { ...req.body };
    delete updates.role;
    delete updates.status;

    const updated = await svcUpdateUser(user.$id, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const targetId = req.params.id ?? user.$id;
    if (targetId !== user.$id && user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    await svcDeleteUser(targetId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getAllUsers(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit ?? 100);
    const result = await svcListUsers(limit);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const user = await svcGetUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const updates = req.body;
    const updated = await svcUpdateUser(req.params.id, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function setRole(req: Request, res: Response) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "role required" });
    const updated = await svcSetRole(req.params.id, role);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function setStatus(req: Request, res: Response) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });
    const updated = await svcSetStatus(req.params.id, status);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
