"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const node_appwrite_1 = require("node-appwrite");
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const token = authHeader.replace("Bearer ", "").trim();
        // Create a fresh client per request
        const client = new node_appwrite_1.Client()
            .setEndpoint(process.env.APPWRITE_ENDPOINT)
            .setProject(process.env.APPWRITE_PROJECT_ID)
            .setJWT(token);
        const account = new node_appwrite_1.Account(client);
        // Validate session and get user
        const user = await account.get();
        req.accountId = user.$id;
        return next();
    }
    catch (err) {
        console.error("❌ Auth middleware error:", err);
        return res.status(401).json({ error: "Unauthorized" });
    }
}
