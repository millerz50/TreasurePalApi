// server/middleware/verifyToken.ts
import { NextFunction, Request, Response } from "express";
import { Account, Client, Databases, Query } from "node-appwrite";
import { UserRole } from "../services/user/user.types";
import { AuthenticatedUser } from "../types/authenticatedUser";

/* =========================
   Extend Express Request
========================= */
declare global {
  namespace Express {
    interface Request {
      accountId?: string;
      authUser?: AuthenticatedUser;
    }
  }
}

/* =========================
   SESSION-BASED AUTH MIDDLEWARE
========================= */
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    /* ---------------------------------
       1️⃣ Extract Appwrite session cookie
    ---------------------------------- */
    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
      return res.status(401).json({ error: "Unauthorized: No cookies" });
    }

    // 🔑 Extract a_session_* cookie ONLY
    const sessionCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith("a_session_"));

    if (!sessionCookie) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No Appwrite session" });
    }

    /* ---------------------------------
       2️⃣ Client using SESSION
    ---------------------------------- */
    const sessionClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setSession(sessionCookie.trim()); // ✅ CORRECT

    const account = new Account(sessionClient);
    const sessionUser = await account.get();

    if (!sessionUser?.$id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    /* ---------------------------------
       3️⃣ Server client (DB access)
    ---------------------------------- */
    const serverClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(serverClient);

    /* ---------------------------------
       4️⃣ Load user profile
    ---------------------------------- */
    const dbId = process.env.APPWRITE_DATABASE_ID!;
    const usersTableId = process.env.APPWRITE_USERTABLE_ID!;

    const result = await databases.listDocuments(dbId, usersTableId, [
      Query.equal("accountid", sessionUser.$id),
    ]);

    const profile = result.documents[0];
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    /* ---------------------------------
       5️⃣ Attach authenticated user
    ---------------------------------- */
    const roles: UserRole[] = Array.isArray(profile.roles)
      ? profile.roles
      : ["user"];

    req.authUser = {
      id: sessionUser.$id,
      email: profile.email,
      roles,
      role: roles[0],
    };

    req.accountId = sessionUser.$id;

    return next();
  } catch (err) {
    console.error("❌ verifyToken error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/* =========================
   ADMIN GUARD
========================= */
export async function verifyTokenAndAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  await verifyToken(req, res, () => {
    if (!req.authUser?.roles.includes("admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}
