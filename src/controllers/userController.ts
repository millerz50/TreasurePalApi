/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import sdk from "node-appwrite";
import path from "path";

import { signupUser } from "../services/user/signupService";
import {
  findByEmail,
  getUserByAccountId,
  deleteUser as svcDeleteUser,
  getUserById as svcGetUserById,
  listAgents as svcListAgents,
  listUsers as svcListUsers,
  setRoles as svcSetRole,
  setStatus as svcSetStatus,
  updateUser as svcUpdateUser,
} from "../services/user/userService";

import { logError } from "./utils/logger";

const DEBUG = process.env.DEBUG === "true";
const dbFile = path.join(__dirname, "phones.json");

/* =========================
   Utils
========================= */

function logStep(step: string, data?: any) {
  if (DEBUG) console.log(`=== STEP: ${step} ===`, data ?? "");
}

function sanitizePhone(value: unknown): string | undefined {
  if (!value) return undefined;
  const s = String(value).trim();
  const normalized = s.replace(/^[\uFF0B]/, "+").replace(/[ \-\(\)]/g, "");
  return /^\+\d{1,15}$/.test(normalized) ? normalized : undefined;
}

/* =========================
   LOGIN  ✅ REQUIRED BY ROUTES
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
   SIGNUP
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
      phone: sanitizePhone(req.body.phone),
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
   UPDATE (PUT) ✅ REQUIRED
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

/* =========================
   EDIT (PATCH)
========================= */

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
   ADMIN
========================= */

export async function getAllUsers(_: Request, res: Response) {
  res.json(await svcListUsers());
}

export async function getUserById(req: Request, res: Response) {
  const user = await svcGetUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
}

export async function setRole(req: Request, res: Response) {
  res.json(await svcSetRole(req.params.id, req.body.role));
}

export async function setStatus(req: Request, res: Response) {
  res.json(await svcSetStatus(req.params.id, req.body.status));
}

export async function getAgents(_: Request, res: Response) {
  res.json(await svcListAgents());
}
