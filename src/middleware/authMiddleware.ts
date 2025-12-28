import { NextFunction, Request, Response } from "express";
import { Account, Client } from "node-appwrite";

// ✅ Extend Express Request type to include accountId
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
  console.log("──────────────── AUTH MIDDLEWARE ────────────────");
  console.log("➡️ Incoming request:", req.method, req.originalUrl);

  try {
    const authHeader = req.headers.authorization;
    console.log("➡️ Authorization header:", authHeader);

    if (!authHeader) {
      console.error("❌ Missing Authorization header");
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing Authorization header" });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    console.log("➡️ Extracted token:", token ? "[REDACTED]" : "EMPTY");

    if (!token) {
      console.error("❌ Invalid token format");
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid token format" });
    }

    // ✅ Create a fresh Appwrite client per request
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setJWT(token);

    const account = new Account(client);

    // ✅ Validate session and get user
    console.log("➡️ Verifying token with Appwrite...");
    const user = await account.get();

    console.log("➡️ Appwrite returned user:", JSON.stringify(user, null, 2));

    if (!user?.$id) {
      console.error("❌ Appwrite returned invalid user object");
      return res.status(401).json({ error: "Unauthorized: Invalid user" });
    }

    req.accountId = user.$id;
    console.log("✅ Auth successful. accountId set on request:", req.accountId);
    console.log("───────────────────────────────────────────────");

    return next();
  } catch (err: any) {
    console.error("❌ Auth middleware error");
    console.error("   ├─ name:", err.name);
    console.error("   ├─ message:", err.message);
    console.error("   ├─ code:", err.code);
    console.error("   ├─ type:", err.type);
    console.error("   └─ response:", err.response);
    console.log("───────────────────────────────────────────────");

    return res.status(401).json({
      error: "Unauthorized",
      reason: err.type || err.message,
    });
  }
}
