"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTokenAndAdmin = verifyTokenAndAdmin;
const node_appwrite_1 = require("node-appwrite");
const client = new node_appwrite_1.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const account = new node_appwrite_1.Account(client);
const databases = new node_appwrite_1.Databases(client);
async function verifyTokenAndAdmin(req, res, next) {
    try {
        const session = await account.get(); // Authenticated user
        const userDoc = await databases.getDocument("TreasurePal", "users", session.$id);
        if (userDoc.role !== "admin") {
            return res.status(403).json({ error: "Admin access required" });
        }
        req.user = {
            id: session.$id,
            role: userDoc.role,
        };
        next();
    }
    catch (err) {
        res.status(401).json({ error: "Unauthorized" });
    }
}
