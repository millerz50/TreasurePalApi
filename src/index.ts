import dotenv from "dotenv";
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env" : ".env.local",
});

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

// Trust proxy when in production (Render, Vercel, etc.)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

//
// Appwrite Client Setup
//
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "")
  .setProject(process.env.APPWRITE_PROJECT_ID || "")
  .setKey(process.env.APPWRITE_API_KEY || "");

export const databases = new Databases(client);

//
// CORS configuration (dynamic, handles preflight)
//
const allowedOrigins = [
  "http://localhost:3000",
  "https://treasure-pal.vercel.app",
  "https://www.treasurepal.co.zw",
  "https://treasurepal.co.zw",
  "https://www.treasurepal.com",
  "https://www.treasureprops.com",
  "https://treasureprops.com",
  "https://www.treasureprops.co.zw",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
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
};

// Apply CORS middleware as early as possible so preflight requests are handled
app.use(cors(corsOptions));

// Explicit preflight handler compatible with newer path-to-regexp / Express versions
// This avoids errors when using '*' or '/*' patterns in some router versions.
app.options("/:path(*)", cors(corsOptions));

//
// Security + Performance
//
app.use(helmet());
app.use(compression());

//
// Body parsing
//
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//
// Logging with Morgan + Winston
//
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

//
// Rate limiting
//
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

//
// Session + Passport
//
const isProd = process.env.NODE_ENV === "production";
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd, // only send cookie over HTTPS in production
      httpOnly: true,
      sameSite: isProd ? "none" : "lax", // allow cross-site cookies when needed
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
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
// Health-check endpoint
//
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

//
// Error handler (must be after routes)
//
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`❌ Uncaught error: ${message}`, err);
  // If it's a CORS origin rejection, return 403 so client sees a clear response
  if (message.startsWith("Not allowed by CORS")) {
    return res.status(403).json({ error: "CORS error", details: message });
  }
  res.status(500).json({
    error: "Internal server error",
    details: message,
  });
});

//
// Graceful shutdown
//
process.on("SIGINT", async () => {
  logger.info("🛑 Shutting down gracefully...");
  process.exit(0);
});

//
// Start server
//
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});

export default app;
