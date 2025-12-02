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

// Routes (must export default Router from each file)
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

// ✅ Trust proxy: safer setting
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1); // trust first proxy hop
}

//
// ✅ Appwrite Client Setup
//
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

export const databases = new Databases(client);

//
// ✅ Security + Performance
//
app.use(helmet());
app.use(compression());

//
// ✅ Dynamic CORS
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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

//
// ✅ Body Parsing
//
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//
// ✅ Logging with Morgan + Winston
//
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

//
// ✅ Rate Limiting
//
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

//
// ✅ Session + Passport
//
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

app.use(passport.initialize());
app.use(passport.session());

//
// ✅ Routes
//
app.use("/api/properties", propertiesRoutes);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/users", userRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/health", healthRoutes);

//
// ✅ OAuth Routes
//

// Google OAuth
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signin" }),
  (req: Request, res: Response) => {
    // Redirect to your frontend dashboard after successful login
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

// Facebook OAuth
app.get(
  "/api/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

app.get(
  "/api/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/signin" }),
  (req: Request, res: Response) => {
    // Redirect to your frontend dashboard after successful login
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

//
// ✅ Error Handler
//
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`❌ Uncaught error: ${message}`, err);
  res.status(500).json({
    error: "Internal server error",
    details: message,
  });
});

//
// ✅ Graceful Shutdown
//
process.on("SIGINT", async () => {
  logger.info("🛑 Shutting down gracefully...");
  process.exit(0);
});

//
// ✅ Start Server
//
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
