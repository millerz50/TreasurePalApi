"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.verifyTokenAndAdmin = verifyTokenAndAdmin;
const node_appwrite_1 = require("node-appwrite");
async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res
                .status(401)
                .json({ error: "Unauthorized: Missing Authorization header" });
        }
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
            return res
                .status(401)
                .json({ error: "Unauthorized: Invalid token format" });
        }
        // ✅ Initialize Appwrite client with JWT
        const client = new node_appwrite_1.Client()
            .setEndpoint(process.env.APPWRITE_ENDPOINT)
            .setProject(process.env.APPWRITE_PROJECT_ID)
            .setJWT(token);
        const account = new node_appwrite_1.Account(client);
        const databases = new node_appwrite_1.Databases(client);
        // ✅ Verify JWT by fetching the account
        const session = await account.get();
        // ✅ Query your users table by accountId
        const userDocs = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, // e.g. treasuredataid
        process.env.APPWRITE_USERTABLE_ID, // e.g. userid
        [node_appwrite_1.Query.equal("accountid", session.$id)]);
        const profile = userDocs.documents[0];
        if (!profile) {
            return res.status(404).json({ error: "Profile not found" });
        }
        // ✅ Attach authenticated user info to request
        req.authUser = { id: session.$id, role: profile.role };
        req.accountId = session.$id;
        return next();
    }
    catch (err) {
        console.error("❌ Auth error:", err);
        return res.status(401).json({ error: "Unauthorized" });
    }
}
async function verifyTokenAndAdmin(req, res, next) {
    await verifyToken(req, res, async () => {
        if (!req.authUser || req.authUser.role !== "admin") {
            return res.status(403).json({ error: "Admin access required" });
        }
        return next();
    });
}
