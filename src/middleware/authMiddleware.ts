import { NextFunction, Request, Response } from "express";
import { Account, Client } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!);

const account = new Account(client);

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

    // Configure client per request with JWT instead of API key
    client.setJWT(token);

    // Validate session and get user
    const user = await account.get();
    req.accountId = user.$id;

    return next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
