import { NextFunction, Request, Response } from "express";
import { Account, Client, Databases, Query } from "node-appwrite";
import { AuthenticatedUser } from "../types/authenticatedUser";

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const token = authHeader.replace("Bearer ", "").trim();

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setJWT(token);

    const account = new Account(client);
    const databases = new Databases(client);

    const session = await account.get();

    const userDocs = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_USERS_COLLECTION_ID!,
      [Query.equal("accountid", session.$id)]
    );

    const profile = userDocs.documents[0];
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    // ✅ use authUser instead of user
    req.authUser = { id: session.$id, role: profile.role } as AuthenticatedUser;
    req.accountId = session.$id;

    next();
  } catch (err) {
    console.error("❌ Auth error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export async function verifyTokenAndAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  await verifyToken(req, res, async () => {
    if (!req.authUser || req.authUser.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}
