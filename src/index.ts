// src/index.ts
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local" });
}
// Render injects env vars in production automatically

import compression from "compression";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";
import { logger } from "./lib/logger";

// Routes
import activityRouter from "./routes/activity";
import agentsRoutes from "./routes/agentRoutes";
import blogRoutes from "./routes/blogsRoutes";
import dashboardRouter from "./routes/dashboard";
import healthRoutes from "./routes/health";
import propertiesRoutes from "./routes/propertyRoutes";
import storageRoutes from "./routes/storageRoutes";
import userRoutes from "./routes/userRoutes";

// Appwrite SDK
import { Client, Databases } from "node-appwrite";

// Passport strategies
import "./strategies/facebook";
import "./strategies/google";

const PORT = parseInt(process.env.PORT || "4011", 10);
const app = express();

// Trust proxy when behind a load balancer (Render, Vercel)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/* =======================================================
   APPWRITE CLIENT
======================================================= */
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "")
  .setProject(process.env.APPWRITE_PROJECT_ID || "")
  .setKey(process.env.APPWRITE_API_KEY || "");

export const databases = new Databases(client);

/* =======================================================
   CORS CONFIG (Node 22 SAFE — No wildcard routes)
======================================================= */
const allowedOrigins = new Set([
  "http://localhost:3000",
  "https://treasure-pal.vercel.app",
  "https://www.treasurepal.co.zw",
  "https://treasurepal.co.zw",
  "https://treasurepal.com",
  "https://www.treasurepal.com",
  "https://www.treasureprops.com",
  "https://treasureprops.com",
  "https://www.treasureprops.co.zw",
]);

// Manual CORS handler (handles preflight safely)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin as string | undefined;

  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (req.method === "OPTIONS") {
    return res.status(403).send("CORS origin not allowed");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-Requested-With,Accept,Origin"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Standard CORS middleware (handles normal requests)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

/* =======================================================
   SECURITY + PERFORMANCE
======================================================= */
app.use(helmet());
app.use(compression());

/* =======================================================
   BODY PARSING
======================================================= */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* =======================================================
   LOGGING
======================================================= */
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

/* =======================================================
   RATE LIMITING
======================================================= */
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
  })
);

/* =======================================================
   SESSION + PASSPORT
======================================================= */
const isProd = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* =======================================================
   ROUTES
======================================================= */
app.use("/api/properties", propertiesRoutes);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/users", userRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/activity", activityRouter);

/* =======================================================
   OAUTH
======================================================= */
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signin" }),
  (req, res) => {
    res.redirect(
      `${process.env.CLIENT_URL || "https://www.treasurepal.co.zw"}/dashboard`
    );
  }
);

app.get(
  "/api/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

app.get(
  "/api/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/signin" }),
  (req, res) => {
    res.redirect(
      `${process.env.CLIENT_URL || "https://www.treasurepal.co.zw"}/dashboard`
    );
  }
);

/* =======================================================
   HEALTH CHECK
======================================================= */
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/* =======================================================
   ERROR HANDLER
======================================================= */
app.use((err: unknown, _req: Request, res: Response) => {
  const message = err instanceof Error ? err.message : String(err);

  logger.error(`❌ Uncaught error: ${message}`, err);

  if (message.includes("Not allowed by CORS")) {
    return res.status(403).json({ error: "CORS error", details: message });
  }

  res.status(500).json({
    error: "Internal server error",
    details: message,
  });
});

/* =======================================================
   START SERVER
======================================================= */
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});

export default app;
