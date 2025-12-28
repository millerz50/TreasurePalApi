import { NextFunction, Request, Response } from "express";

import { jwtDecode } from "jwt-decode";

import { Account, Client } from "node-appwrite";

/* -------------------------------------------------------------------------- */
/*                          Express Type Extension                             */
/* -------------------------------------------------------------------------- */

declare global {
  namespace Express {
    interface Request {
      accountId?: string;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface DecodedJWT {
  sub: string;
  iat: number;
  exp: number;
}

/* -------------------------------------------------------------------------- */
/*                               Middleware                                   */
/* -------------------------------------------------------------------------- */

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  console.log("──────────────── AUTH ────────────────");
  console.log("➡️ ", req.method, req.originalUrl);
  console.log("➡️ Authorization:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("❌ Missing or malformed Authorization header");
    return res.status(401).json({
      error: "Unauthorized: Missing Authorization header",
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  /* ------------------------------------------------------------------------ */
  /*                         Local JWT Inspection (Debug)                      */
  /* ------------------------------------------------------------------------ */

  try {
    const decoded = jwtDecode<DecodedJWT>(token);

    const now = Date.now();
    const expMs = decoded.exp * 1000;

    console.log("🧾 JWT INFO");
    console.log("   ├─ userId:", decoded.sub);
    console.log("   ├─ issued:", new Date(decoded.iat * 1000).toISOString());
    console.log("   ├─ expires:", new Date(expMs).toISOString());
    console.log("   └─ expired:", expMs < now);

    if (expMs < now) {
      console.error("⛔ JWT already expired BEFORE Appwrite validation");
      return res.status(401).json({
        error: "Unauthorized: Token expired",
      });
    }
  } catch (err) {
    console.error("❌ JWT decode failed (invalid token format)", err);
    return res.status(401).json({
      error: "Unauthorized: Invalid token",
    });
  }

  /* ------------------------------------------------------------------------ */
  /*                         Appwrite Verification                             */
  /* ------------------------------------------------------------------------ */

  try {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setJWT(token);

    const account = new Account(client);
    const user = await account.get();

    if (!user?.$id) {
      console.error("❌ Appwrite returned invalid user");
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("✅ AUTH OK:", user.$id);
    console.log("────────────────────────────────────");

    req.accountId = user.$id;
    return next();
  } catch (err: any) {
    console.error("❌ Appwrite JWT validation failed");
    console.error("   ├─ message:", err.message);
    console.error("   ├─ code:", err.code);
    console.error("   └─ type:", err.type);
    console.log("────────────────────────────────────");

    return res.status(401).json({
      error: "Unauthorized",
      reason: err.type,
    });
  }
}
