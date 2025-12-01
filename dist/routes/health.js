"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// server/routes/health.ts
const express_1 = require("express");
const appwriteConfig_1 = require("../appwrite/appwriteConfig");
const router = (0, express_1.Router)();
// Prefer explicit env; fail fast if not set so the health check is meaningful
const DB_ID = process.env.APPWRITE_DATABASE_ID;
if (!DB_ID) {
    // optional: throw here during app bootstrap instead of at request-time
    console.warn("APPWRITE_DATABASE_ID not set — /health will report disconnected");
}
router.get("/health", async (_req, res) => {
    const timestamp = new Date().toISOString();
    if (!DB_ID) {
        return res.status(503).json({
            status: "error",
            db: "disconnected",
            timestamp,
            tableCount: 0,
            message: "DB id not configured",
        });
    }
    try {
        const tablesDB = appwriteConfig_1.tables;
        const result = await tablesDB.listTables(DB_ID);
        return res.status(200).json({
            status: "ok",
            db: "connected",
            timestamp,
            tableCount: typeof result.total === "number" ? result.total : 0,
        });
    }
    catch (err) {
        // log full error server-side for debugging, but avoid leaking secrets to clients
        console.error("❌ TablesDB connection failed:", err?.message ?? err, err?.response ?? "");
        return res.status(503).json({
            status: "error",
            db: "disconnected",
            timestamp,
            tableCount: 0,
            message: "failed to connect to TablesDB",
        });
    }
});
exports.default = router;
