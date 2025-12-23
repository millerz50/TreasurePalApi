/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import sdk from "node-appwrite";

import { signupUser } from "../services/user/signupService";
import {
  findByEmail,
  getUserByAccountId,
  deleteUser as svcDeleteUser,
  getUserById as svcGetUserById,
  listAgents as svcListAgents,
  listUsers as svcListUsers,
  setRoles as svcSetRoles,
  setStatus as svcSetStatus,
  updateUser as svcUpdateUser,
} from "../services/user/userService";

import { logError } from "./utils/logger";

/* =========================
   LOGIN
========================= */
export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const client = new sdk.Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const account = new sdk.Account(client);

    const session = await account.createEmailPasswordSession(
      email.toLowerCase().trim(),
      password
    );

    res.json({ session });
  } catch (err) {
    logError("loginUser failed", err);
    res.status(401).json({ error: "Invalid credentials" });
  }
}

/* =========================
   SIGNUP (DEFAULT USER)
========================= */
export async function signup(req: Request, res: Response) {
  try {
    const { email, password, firstName, surname } = req.body;
    if (!email || !password || !firstName || !surname)
      return res.status(400).json({ error: "Missing required fields" });

    const normalizedEmail = email.toLowerCase().trim();

    if (await findByEmail(normalizedEmail))
      return res.status(409).json({ error: "User already exists" });

    const result = await signupUser({
      ...req.body,
      email: normalizedEmail,
    });

    res.status(201).json({ profile: result.profile });
  } catch (err) {
    logError("signup failed", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/* =========================
   PROFILE
========================= */
export async function getUserProfile(req: Request, res: Response) {
  const accountId = (req as any).accountId;
  if (!accountId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getUserByAccountId(accountId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  res.json(profile);
}

/* =========================
   UPDATE
========================= */
export async function updateUser(req: Request, res: Response) {
  try {
    const updated = await svcUpdateUser(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    logError("updateUser failed", err);
    res.status(400).json({ error: "Update failed" });
  }
}

export async function editUser(req: Request, res: Response) {
  try {
    const updated = await svcUpdateUser(req.params.id, req.body);
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Edit failed" });
  }
}

/* =========================
   DELETE
========================= */
export async function deleteUser(req: Request, res: Response) {
  await svcDeleteUser(req.params.id);
  res.status(204).send();
}

/* =========================
   ADMIN — USERS
========================= */
export async function getAllUsers(_: Request, res: Response) {
  res.json(await svcListUsers());
}

export async function getUserById(req: Request, res: Response) {
  const user = await svcGetUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
}

/* =========================
   ADMIN — ROLE MANAGEMENT
========================= */

/**
 * Replace roles completely
 * PATCH /users/:id/role
 */
export async function setRoles(req: Request, res: Response) {
  const { roles } = req.body;

  if (!Array.isArray(roles)) {
    return res.status(400).json({ error: "roles must be an array" });
  }

  const allowed = ["user", "agent", "admin"];
  if (!roles.every((r) => allowed.includes(r))) {
    return res.status(400).json({ error: "Invalid role supplied" });
  }

  const updated = await svcSetRoles(req.params.id, roles);
  res.json(updated);
}

/**
 * ✅ OPTION C — APPROVE AGENT
 * PATCH /users/:id/approve-agent
 */
export async function approveAgent(req: Request, res: Response) {
  const userId = req.params.id;

  const user = await svcGetUserById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const updated = await svcUpdateUser(userId, {
    roles: ["user", "agent"],
    status: "Active",
  });

  res.json({
    message: "Agent approved successfully",
    user: updated,
  });
}

/* =========================
   ADMIN — STATUS
========================= */
export async function setStatus(req: Request, res: Response) {
  const allowed = ["Not Verified", "Pending", "Active", "Suspended"];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  res.json(await svcSetStatus(req.params.id, req.body.status));
}

/* =========================
   AGENTS
========================= */
export async function getAgents(_: Request, res: Response) {
  res.json(await svcListAgents());
}
