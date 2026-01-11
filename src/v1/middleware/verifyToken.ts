// server/middleware/verifyToken.ts
import { NextFunction, Request, Response } from "express";
import { Account, Client, Databases, Query } from "node-appwrite";
import { UserRole } from "../services/user/user.types";
import { AuthenticatedUser } from "../types/authenticatedUser";

/* =========================
   Extend Express Request type
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
   Middleware: Verify JWT and attach authenticated user info
   - Uses a JWT client to validate the session (Account.get)
   - Uses a server client (API key) to query the users collection (Databases)
   - Attaches req.authUser and req.accountId
========================= */
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

    // 1) Client with JWT: validate the token and fetch the account
    const jwtClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setJWT(token);

    const account = new Account(jwtClient);

    console.log("➡️ [verifyToken] Verifying session with Account.get()");
    const session = await account.get();
    if (!session?.$id) {
      console.error("❌ [verifyToken] Account.get() returned no $id");
      return res.status(401).json({ error: "Unauthorized: Invalid session" });
    }

    // 2) Server client with API key: use for privileged DB queries
    //    This avoids user_unauthorized when listing documents in the users collection
    const serverClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(serverClient);

    // Query users collection by accountid (account.$id)
    const dbId = process.env.APPWRITE_DATABASE_ID!;
    const usersTableId = process.env.APPWRITE_USERTABLE_ID!;

    console.log(
      "➡️ [verifyToken] Looking up profile for accountId:",
      session.$id
    );
    const userDocs = await databases.listDocuments(dbId, usersTableId, [
      Query.equal("accountid", session.$id),
    ]);

    const profile = userDocs.documents[0];
    if (!profile) {
      console.warn(
        "⚠️ [verifyToken] Profile not found for accountId:",
        session.$id
      );
      return res.status(404).json({ error: "Profile not found" });
    }

    // Attach authenticated user info
    const roles: UserRole[] = Array.isArray(profile.roles) ? profile.roles : [];
    req.authUser = {
      id: session.$id,
      email: profile.email,
      roles,
      role: roles.length > 0 ? roles[0] : ("user" as UserRole),
    };
    req.accountId = session.$id;

    console.log(
      "🔐 [verifyToken] Authenticated user:",
      req.accountId,
      req.authUser.roles
    );

    return next();
  } catch (err: any) {
    console.error("❌ [verifyToken] Auth error:", err?.message || err);
    // If Appwrite returned a structured error, include type for debugging
    if (err?.type === "user_unauthorized" || err?.code === 401) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/* =========================
   Middleware: Verify JWT + Admin role
========================= */
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
