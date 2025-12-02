"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databases = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({
    path: process.env.NODE_ENV === "production" ? ".env" : ".env.local",
});
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_session_1 = __importDefault(require("express-session"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const passport_1 = __importDefault(require("passport"));
const logger_1 = require("./lib/logger");
// Routes (must export default Router from each file)
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
// ✅ Trust proxy: safer setting
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1); // trust first proxy hop
}
//
// ✅ Appwrite Client Setup
//
const client = new node_appwrite_1.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
exports.databases = new node_appwrite_1.Databases(client);
//
// ✅ Security + Performance
//
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`Not allowed by CORS: ${origin}`));
        }
    },
    credentials: true,
}));
//
// ✅ Body Parsing
//
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
//
// ✅ Logging with Morgan + Winston
//
app.use((0, morgan_1.default)("combined", {
    stream: {
        write: (message) => logger_1.logger.info(message.trim()),
    },
}));
//
// ✅ Rate Limiting
//
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api", limiter);
//
// ✅ Session + Passport
//
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
//
// ✅ Routes
//
app.use("/api/properties", propertyRoutes_1.default);
app.use("/api/dashboard", dashboard_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/storage", storageRoutes_1.default);
app.use("/api/agents", agentRoutes_1.default);
app.use("/api/blogs", blogsRoutes_1.default);
app.use("/api/health", health_1.default);
//
// ✅ OAuth Routes
//
app.get("/api/auth/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
app.get("/api/auth/google/callback", passport_1.default.authenticate("google", { failureRedirect: "/signin" }), (req, res) => {
    res.redirect("https://treasure-pal.vercel.app/dashboard");
});
app.get("/api/auth/facebook", passport_1.default.authenticate("facebook", { scope: ["email"] }));
app.get("/api/auth/facebook/callback", passport_1.default.authenticate("facebook", { failureRedirect: "/signin" }), (req, res) => {
    res.redirect("https://treasure-pal.vercel.app/dashboard");
});
//
// ✅ Error Handler
//
app.use((err, req, res, next) => {
    const message = err instanceof Error ? err.message : String(err);
    logger_1.logger.error(`❌ Uncaught error: ${message}`, err);
    res.status(500).json({
        error: "Internal server error",
        details: message,
    });
});
//
// ✅ Graceful Shutdown
//
process.on("SIGINT", async () => {
    logger_1.logger.info("🛑 Shutting down gracefully...");
    process.exit(0);
});
//
// ✅ Start Server
//
app.listen(PORT, () => {
    logger_1.logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
