"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databases = void 0;
// src/index.ts
const dotenv_1 = __importDefault(require("dotenv"));
if (process.env.NODE_ENV !== "production") {
    dotenv_1.default.config({ path: ".env.local" });
}
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_session_1 = __importDefault(require("express-session"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const passport_1 = __importDefault(require("passport"));
const logger_1 = require("./lib/logger");
// Routes
const activity_1 = __importDefault(require("./routes/activity"));
const agentRoutes_1 = __importDefault(require("./routes/agentRoutes"));
const blogsRoutes_1 = __importDefault(require("./routes/blogsRoutes"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const health_1 = __importDefault(require("./routes/health"));
const propertyRoutes_1 = __importDefault(require("./routes/propertyRoutes"));
const storageRoutes_1 = __importDefault(require("./routes/storageRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
// Appwrite SDK
const node_appwrite_1 = require("node-appwrite");
// Passport strategies
require("./strategies/facebook");
require("./strategies/google");
const PORT = parseInt(process.env.PORT || "4011", 10);
const app = (0, express_1.default)();
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}
/* =======================================================
   APPWRITE
======================================================= */
const client = new node_appwrite_1.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "")
    .setProject(process.env.APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "");
exports.databases = new node_appwrite_1.Databases(client);
/* =======================================================
   CORS CONFIG — FIXED FOR NODE 22
======================================================= */
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
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
}));
// Preflight — MUST NOT USE "*"
app.options("/api/*", (0, cors_1.default)());
/* =======================================================
   SECURITY + PERFORMANCE
======================================================= */
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
/* =======================================================
   BODY PARSING
======================================================= */
app.use(express_1.default.json({ limit: "2mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
/* =======================================================
   LOGGING
======================================================= */
app.use((0, morgan_1.default)("combined", {
    stream: { write: (msg) => logger_1.logger.info(msg.trim()) },
}));
/* =======================================================
   RATE LIMITING
======================================================= */
app.use("/api", (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
}));
/* =======================================================
   SESSION + PASSPORT
======================================================= */
const isProd = process.env.NODE_ENV === "production";
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || "change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProd,
        httpOnly: true,
        sameSite: isProd ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
/* =======================================================
   API ROUTES
======================================================= */
app.use("/api/properties", propertyRoutes_1.default);
app.use("/api/dashboard", dashboard_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/storage", storageRoutes_1.default);
app.use("/api/agents", agentRoutes_1.default);
app.use("/api/blogs", blogsRoutes_1.default);
app.use("/api/health", health_1.default);
app.use("/api/activity", activity_1.default);
/* =======================================================
   OAUTH
======================================================= */
app.get("/api/auth/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
app.get("/api/auth/google/callback", passport_1.default.authenticate("google", { failureRedirect: "/signin" }), (_req, res) => {
    res.redirect(`${process.env.CLIENT_URL || "https://www.treasurepal.co.zw"}/dashboard`);
});
app.get("/api/auth/facebook", passport_1.default.authenticate("facebook", { scope: ["email"] }));
app.get("/api/auth/facebook/callback", passport_1.default.authenticate("facebook", { failureRedirect: "/signin" }), (_req, res) => {
    res.redirect(`${process.env.CLIENT_URL || "https://www.treasurepal.co.zw"}/dashboard`);
});
/* =======================================================
   HEALTH CHECK
======================================================= */
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
/* =======================================================
   GLOBAL ERROR HANDLER
======================================================= */
app.use((err, _req, res, _next) => {
    logger_1.logger.error("❌ Error:", err);
    if (err?.message?.includes("CORS")) {
        return res.status(403).json({ error: "CORS error", details: err.message });
    }
    res.status(500).json({
        error: "Internal server error",
        details: err.message || err,
    });
});
/* =======================================================
   START SERVER
======================================================= */
app.listen(PORT, () => {
    logger_1.logger.info(`🚀 Server running on port ${PORT}`);
});
exports.default = app;
