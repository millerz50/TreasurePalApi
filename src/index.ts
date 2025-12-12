// src/index.ts
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local" });
}

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

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

//
// Appwrite Setup
//
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "")
  .setProject(process.env.APPWRITE_PROJECT_ID || "")
  .setKey(process.env.APPWRITE_API_KEY || "");

export const databases = new Databases(client);

//
// CORRECTED CORS — single middleware only
//
const allowedOrigins = [
  "http://localhost:3000",
  "https://treasure-pal.vercel.app",
  "https://www.treasurepal.co.zw",
  "https://treasurepal.co.zw",
  "https://treasurepal.com",
  "https://www.treasurepal.com",
  "https://www.treasureprops.com",
  "https://treasureprops.com",
  "https://www.treasureprops.co.zw",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);

app.options("*", cors());

//
// Security + Performance
//
app.use(helmet());
app.use(compression());

//
// Body parsing
//
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

//
// Logging
//
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

//
// Rate limiting
//
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
  })
);

//
// Session + Passport
//
const isProd = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this",
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

//
// Routes
//
app.use("/api/properties", propertiesRoutes);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/users", userRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/activity", activityRouter);

//
// OAuth Routes
//
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signin" }),
  (req: Request, res: Response) => {
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
  (req: Request, res: Response) => {
    res.redirect(
      `${process.env.CLIENT_URL || "https://www.treasurepal.co.zw"}/dashboard`
    );
  }
);

//
// Health check
//
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));

//
// Error handler
//
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("❌ Error:", err);

  if (err?.message?.includes("CORS")) {
    return res.status(403).json({ error: "CORS error", details: err.message });
  }

  res.status(500).json({
    error: "Internal server error",
    details: err.message || err,
  });
});

//
// Start server
//
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});

export default app;
