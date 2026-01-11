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

/* helper to dump request info */
function debugRequest(req: Request, label: string) {
  console.log(`\n===== ${label} =====`);
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Headers:", req.headers);
  console.log("Params:", req.params);
  console.log("Query:", req.query);
  console.log("Body:", req.body);
  console.log("====================\n");
}

/* =========================
   LOGIN
========================= */
export async function loginUser(req: Request, res: Response) {
  debugRequest(req, "loginUser");
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      console.warn("Missing email or password in body");
      return res.status(400).json({ error: "Email and password required" });
    }

    const client = new sdk.Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const account = new sdk.Account(client);

    console.log("Creating session for:", email);
    const session = await account.createEmailPasswordSession(
      email.toLowerCase().trim(),
      password
    );

    console.log("Session created:", session);
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
  debugRequest(req, "signup");
  try {
    if (!req.body) {
      console.error("req.body is undefined!");
      return res.status(400).json({ error: "Request body missing" });
    }

    const { email, password, firstName, surname } = req.body;
    if (!email || !password || !firstName || !surname) {
      console.warn("Missing required fields:", {
        email,
        password,
        firstName,
        surname,
      });
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log("Normalized email:", normalizedEmail);

    const existing = await findByEmail(normalizedEmail);
    console.log("Existing user lookup:", existing);
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    console.log("Calling signupUser with payload:", {
      ...req.body,
      email: normalizedEmail,
    });
    const result = await signupUser({
      ...req.body,
      email: normalizedEmail,
    });

    console.log("Signup result:", result);
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
  debugRequest(req, "getUserProfile");
  const accountId = (req as any).accountId;
  console.log("Resolved accountId:", accountId);
  if (!accountId) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getUserByAccountId(accountId);
  console.log("Fetched profile:", profile);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  res.json(profile);
}

/* =========================
   UPDATE
========================= */
export async function updateUser(req: Request, res: Response) {
  debugRequest(req, "updateUser");
  try {
    const updated = await svcUpdateUser(req.params.id, req.body);
    console.log("Update result:", updated);
    res.json(updated);
  } catch (err) {
    logError("updateUser failed", err);
    res.status(400).json({ error: "Update failed" });
  }
}

export async function editUser(req: Request, res: Response) {
  debugRequest(req, "editUser");
  try {
    const updated = await svcUpdateUser(req.params.id, req.body);
    console.log("Edit result:", updated);
    res.json(updated);
  } catch (err) {
    console.error("Edit failed:", err);
    res.status(400).json({ error: "Edit failed" });
  }
}

/* =========================
   DELETE
========================= */
export async function deleteUser(req: Request, res: Response) {
  debugRequest(req, "deleteUser");
  await svcDeleteUser(req.params.id);
  console.log("Deleted user:", req.params.id);
  res.status(204).send();
}

/* =========================
   ADMIN — USERS
========================= */
export async function getAllUsers(_: Request, res: Response) {
  console.log("Fetching all users");
  res.json(await svcListUsers());
}

export async function getUserById(req: Request, res: Response) {
  debugRequest(req, "getUserById");
  const user = await svcGetUserById(req.params.id);
  console.log("Fetched user:", user);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
}

/* =========================
   ADMIN — ROLE MANAGEMENT
========================= */
export async function setRoles(req: Request, res: Response) {
  debugRequest(req, "setRoles");
  const { roles } = req.body;
  console.log("Roles payload:", roles);

  if (!Array.isArray(roles)) {
    return res.status(400).json({ error: "roles must be an array" });
  }

  const allowed = ["user", "agent", "admin"];
  if (!roles.every((r) => allowed.includes(r))) {
    return res.status(400).json({ error: "Invalid role supplied" });
  }

  const updated = await svcSetRoles(req.params.id, roles);
  console.log("Roles updated:", updated);
  res.json(updated);
}

export async function approveAgent(req: Request, res: Response) {
  debugRequest(req, "approveAgent");
  const userId = req.params.id;
  console.log("Approving agent:", userId);

  const user = await svcGetUserById(userId);
  console.log("Fetched user for approval:", user);
  if (!user) return res.status(404).json({ error: "User not found" });

  const updated = await svcUpdateUser(userId, {
    roles: ["user", "agent"],
    status: "Active",
  });
  console.log("Agent approved:", updated);

  res.json({
    message: "Agent approved successfully",
    user: updated,
  });
}

/* =========================
   ADMIN — STATUS
========================= */
export async function setStatus(req: Request, res: Response) {
  debugRequest(req, "setStatus");
  const allowed = ["Not Verified", "Pending", "Active", "Suspended"];
  console.log("Status payload:", req.body.status);
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const updated = await svcSetStatus(req.params.id, req.body.status);
  console.log("Status updated:", updated);
  res.json(updated);
}

/* =========================
   AGENTS
========================= */
export async function getAgents(_: Request, res: Response) {
  console.log("Fetching agents");
  res.json(await svcListAgents());
}
