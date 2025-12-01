"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signup = signup;
exports.loginUser = loginUser;
exports.getUserProfile = getUserProfile;
exports.editUser = editUser;
exports.deleteUser = deleteUser;
exports.getAllUsers = getAllUsers;
exports.getUserById = getUserById;
exports.updateUser = updateUser;
exports.setRole = setRole;
exports.setStatus = setStatus;
exports.getAgents = getAgents;
const storageService_1 = require("../services/storageService");
const userService_1 = require("../services/userService");
// 🆕 Signup handled by server: creates Appwrite auth user + profile row
async function signup(req, res) {
    try {
        const { email, password, firstName, surname, role = "user", phone, // ✅ just pass through, no validation
        nationalId, bio, metadata, } = req.body;
        if (!email || !password || !firstName || !surname) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const exists = await (0, userService_1.findByEmail)(String(email).toLowerCase());
        if (exists)
            return res.status(409).json({ error: "User already exists" });
        let avatarFileId;
        const file = req.file;
        if (file) {
            const result = await (0, storageService_1.uploadToAppwriteBucket)(file.buffer, file.originalname);
            avatarFileId =
                result?.fileId ?? (typeof result === "string" ? result : undefined);
        }
        const payload = {
            email: String(email).toLowerCase(),
            password: String(password),
            firstName,
            surname,
            role,
            phone, // ✅ passed directly
            nationalId,
            bio,
            avatarFileId,
            metadata,
            status: "Active",
        };
        const user = await (0, userService_1.createUser)(payload);
        res.status(201).json(user);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Signup failed";
        res.status(400).json({ error: message });
    }
}
// 🔑 Login is client-side via Appwrite SDK
async function loginUser(_req, res) {
    res
        .status(501)
        .json({ error: "Login handled by Appwrite Accounts; use client SDK" });
}
// 👤 Current user profile based on Appwrite accountId (from middleware)
async function getUserProfile(req, res) {
    try {
        const accountId = req.accountId;
        if (!accountId)
            return res.status(401).json({ error: "Unauthorized" });
        const profile = await (0, userService_1.getUserByAccountId)(accountId);
        if (!profile)
            return res.status(404).json({ error: "Profile not found" });
        res.json(profile);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ error: message });
    }
}
// ✏️ Edit user (excluding role/status)
async function editUser(req, res) {
    try {
        const targetId = req.params.id;
        const updates = { ...req.body };
        delete updates.role;
        delete updates.status;
        const updated = await (0, userService_1.updateUser)(targetId, updates);
        res.json(updated);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        res.status(400).json({ error: message });
    }
}
// ❌ Delete user
async function deleteUser(req, res) {
    try {
        const targetId = req.params.id;
        await (0, userService_1.deleteUser)(targetId);
        res.status(204).send();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Delete failed";
        res.status(400).json({ error: message });
    }
}
// 📋 List all users
async function getAllUsers(req, res) {
    try {
        const limit = Number(req.query.limit ?? 100);
        const result = await (0, userService_1.listUsers)(limit);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ error: message });
    }
}
// 🔎 Get user by ID
async function getUserById(req, res) {
    try {
        const user = await (0, userService_1.getUserById)(req.params.id);
        if (!user)
            return res.status(404).json({ error: "Not found" });
        res.json(user);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ error: message });
    }
}
// ✏️ Update user
async function updateUser(req, res) {
    try {
        const updates = req.body;
        const updated = await (0, userService_1.updateUser)(req.params.id, updates);
        res.json(updated);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        res.status(400).json({ error: message });
    }
}
// 🔧 Set role
async function setRole(req, res) {
    try {
        const { role } = req.body;
        if (!role)
            return res.status(400).json({ error: "role required" });
        const updated = await (0, userService_1.setRole)(req.params.id, role);
        res.json(updated);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Set role failed";
        res.status(400).json({ error: message });
    }
}
// 🔧 Set status
async function setStatus(req, res) {
    try {
        const { status } = req.body;
        if (!status)
            return res.status(400).json({ error: "status required" });
        const updated = await (0, userService_1.setStatus)(req.params.id, status);
        res.json(updated);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Set status failed";
        res.status(400).json({ error: message });
    }
}
// 👥 List agents
async function getAgents(_req, res) {
    try {
        const agents = await (0, userService_1.listAgents)();
        res.json(agents);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch agents";
        res.status(500).json({ error: message });
    }
}
