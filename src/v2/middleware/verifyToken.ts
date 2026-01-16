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
   JWT-BASED AUTH MIDDLEWARE
========================= */
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    /* ---------------------------------
       1️⃣ Read Authorization header
    ---------------------------------- */
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token" });
    }

    const jwt = authHeader.replace("Bearer ", "");

    /* ---------------------------------
       2️⃣ Appwrite client (JWT)
    ---------------------------------- */
    const sessionClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setJWT(jwt);

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
    const result = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_USERTABLE_ID!,
      [Query.equal("accountid", sessionUser.$id)]
    );

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
  try {
    await verifyToken(req, res, () => Promise.resolve()); // call verifyToken properly

    // Check admin role
    if (!req.authUser?.roles.includes("admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }

    return next();
  } catch (err) {
    console.error("❌ verifyTokenAndAdmin error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
