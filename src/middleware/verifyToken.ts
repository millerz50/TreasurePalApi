import { NextFunction, Request, Response } from "express";
import { Account, Client, Databases, Query } from "node-appwrite";
import { UserRole } from "../services/user/user.types";
import { AuthenticatedUser } from "../types/authenticatedUser";

// ✅ Extend Express Request type to include accountId and authUser
declare global {
  namespace Express {
    interface Request {
      accountId?: string;
      authUser?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware: Verify JWT and attach authenticated user info
 */
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing Authorization header" });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid token format" });
    }

    // Initialize Appwrite client with JWT
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setJWT(token);

    const account = new Account(client);
    const databases = new Databases(client);

    // Verify JWT by fetching the account
    const session = await account.get();

    // Query users collection by accountId
    const userDocs = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_USERTABLE_ID!,
      [Query.equal("accountid", session.$id)]
    );

    const profile = userDocs.documents[0];
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Attach authenticated user info
    const roles: UserRole[] = Array.isArray(profile.roles) ? profile.roles : [];
    req.authUser = {
      id: session.$id,
      email: profile.email,
      roles,
      role: roles.length > 0 ? roles[0] : "user", // pick first role as primary
    };
    req.accountId = session.$id;

    return next();
  } catch (err) {
    console.error("❌ Auth error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Middleware: Verify JWT + Admin role
 */
export async function verifyTokenAndAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  await verifyToken(req, res, async () => {
    if (!req.authUser || !req.authUser.roles.includes("admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }
    return next();
  });
}
