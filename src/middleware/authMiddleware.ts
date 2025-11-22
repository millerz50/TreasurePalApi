// server/middleware/authMiddleware.ts
import { NextFunction, Request, Response } from "express";
import { Account, Client } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

// NOTE: Using API key to verify sessions is one approach.
// If you rely on client sessions, you can also accept JWTs from headers/cookies.
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
    // Example: read Appwrite userId from a header set by your edge or login proxy
    // Preferably validate a JWT or session cookie. Adjust as needed.
    const accountId = req.header("x-appwrite-account-id");

    if (!accountId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.accountId = accountId;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
