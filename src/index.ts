import dotenv from "dotenv";
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env" : ".env.local",
});

import compression from "compression";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { logger } from "./lib/logger";
import health from "./routes/health";

// Appwrite SDK
import { Client, Databases } from "node-appwrite";

// Routers
import dashboardRouter from "./routes/dashboard";
import propertiesRoutes from "./routes/propertyRoutes";
import storageRoutes from "./routes/storageRoutes";
import userRoutes from "./routes/userRoutes";

const PORT = parseInt(process.env.PORT || "4011", 10);
const app = express();

app.set("trust proxy", true);

//
// ✅ Appwrite Client Setup
//
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

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
];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

//
// ✅ Body Parsing
//
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/json", express.json());

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
  validate: {
    trustProxy: false,
  },
});

app.use("/api", limiter);

//
// ✅ Routes
//
app.use("/api/properties", propertiesRoutes);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/users", userRoutes);
app.use("/api/storage", storageRoutes);
//
// ✅ Health Check (Appwrite Ping)
//
app.use("/api/", health);

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
