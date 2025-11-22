import { NextFunction, Request, Response } from "express";
import { Account, Client } from "node-appwrite";

// Extend Express Request type to include accountId
declare global {
  namespace Express {
    interface Request {
      accountId?: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Create a fresh client per request
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setJWT(token);

    const account = new Account(client);

    // Validate session and get user
    const user = await account.get();
    req.accountId = user.$id;

    return next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
