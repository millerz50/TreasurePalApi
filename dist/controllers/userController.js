"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
/* eslint-disable @typescript-eslint/no-explicit-any */
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = require("crypto");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const userService_1 = require("../services/user/userService");
const storageService_1 = require("../services/storage/storageService");
const logger_1 = require("./utils/logger");
const DEBUG = process.env.DEBUG === "true";
const dbFile = path_1.default.join(__dirname, "phones.json");
// ----------------------------
// Utils
// ----------------------------
function logStep(step, data) {
    if (DEBUG)
        console.log(`=== STEP: ${step} ===`, data ?? "");
}
// Strict phone sanitizer (optional)
function sanitizePhone(value) {
    if (!value)
        return null;
    const s = String(value).trim();
    const normalized = s.replace(/^[\uFF0B]/, "+").replace(/[ \-\(\)]/g, "");
    return /^\+\d{1,15}$/.test(normalized) ? normalized : null;
}
// Save phone locally in JSON
async function savePhoneToExternalDB(userId, phone) {
    try {
        let data = {};
        try {
            const fileContent = await promises_1.default.readFile(dbFile, "utf-8");
            data = JSON.parse(fileContent);
        }
        catch (err) {
            if (err.code !== "ENOENT")
                throw err;
        }
        data[userId] = phone;
        await promises_1.default.writeFile(dbFile, JSON.stringify(data, null, 2), "utf-8");
        logStep("Saved phone locally", { userId, phone });
    }
    catch (err) {
        (0, logger_1.logError)("savePhoneToExternalDB", err, { userId, phone });
        throw err;
    }
}
// ----------------------------
// Signup handler
// ----------------------------
async function signup(req, res) {
    try {
        const { email, password, firstName, surname, role = "user", nationalId, bio, country, location, dateOfBirth, } = req.body;
        if (!email || !password || !firstName || !surname) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        logStep("Signup request received", { email, firstName, surname, role });
        const exists = await (0, userService_1.findByEmail)(email.toLowerCase());
        if (exists)
            return res.status(409).json({ error: "User already exists" });
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        logStep("Password hashed");
        let avatarFileId;
        try {
            const file = req.file;
            if (file) {
                const result = await (0, storageService_1.uploadToAppwriteBucket)(file.buffer, file.originalname);
                avatarFileId =
                    result?.fileId ?? (typeof result === "string" ? result : undefined);
                logStep("Avatar uploaded", { avatarFileId });
            }
        }
        catch (err) {
            (0, logger_1.logError)("avatarUpload failed", err, { email });
        }
        const agentId = role === "agent" ? (0, crypto_1.randomUUID)() : undefined;
        logStep("Generated agent ID if applicable", { agentId });
        const servicePayload = {
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName,
            surname,
            country,
            location,
            role,
            status: "Active",
            nationalId,
            bio: bio ?? undefined,
            avatarUrl: avatarFileId,
            dateOfBirth,
            agentId,
            accountId: req.body.accountId,
        };
        let user;
        try {
            user = await (0, userService_1.createUser)(servicePayload);
            logStep("Created user in DB", user);
        }
        catch (err) {
            (0, logger_1.logError)("createUser failed", err, { servicePayload });
            return res.status(500).json({ error: "Failed to create user" });
        }
        return res.status(201).json({ profile: user.profile });
    }
    catch (err) {
        (0, logger_1.logError)("signup handler failed", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
// ----------------------------
// Other controllers
// ----------------------------
async function loginUser(_req, res) {
    res
        .status(501)
        .json({ error: "Login handled by Appwrite Accounts; use client SDK" });
}
async function getUserProfile(req, res) {
    try {
        const accountId = req.accountId;
        if (!accountId)
            return res.status(401).json({ error: "Unauthorized" });
        const profile = await (0, userService_1.getUserByAccountId)(accountId);
        if (!profile)
            return res.status(404).json({ error: "Profile not found" });
        let phone;
        try {
            const fileContent = await promises_1.default.readFile(dbFile, "utf-8");
            const data = JSON.parse(fileContent);
            if (profile?.$id)
                phone = data[profile.$id];
        }
        catch (err) {
            if (DEBUG)
                console.error("Failed to read phone JSON:", err);
        }
        res.json({
            userId: profile.$id,
            email: profile.email,
            role: profile.role,
            status: profile.status,
            phone: phone ?? null,
            bio: profile.bio,
            avatarFileId: profile.avatarUrl ?? null,
            firstName: profile.firstName ?? "",
            surname: profile.surname ?? "",
        });
    }
    catch (err) {
        res
            .status(500)
            .json({ error: err instanceof Error ? err.message : "Server error" });
    }
}
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
        res
            .status(400)
            .json({ error: err instanceof Error ? err.message : "Update failed" });
    }
}
async function deleteUser(req, res) {
    try {
        const targetId = req.params.id;
        await (0, userService_1.deleteUser)(targetId);
        res.status(204).send();
    }
    catch (err) {
        res
            .status(400)
            .json({ error: err instanceof Error ? err.message : "Delete failed" });
    }
}
async function getAllUsers(req, res) {
    try {
        const limit = Number(req.query.limit ?? 100);
        const result = await (0, userService_1.listUsers)(limit);
        res.json(result);
    }
    catch (err) {
        res
            .status(500)
            .json({ error: err instanceof Error ? err.message : "Server error" });
    }
}
async function getUserById(req, res) {
    try {
        const user = await (0, userService_1.getUserById)(req.params.id);
        if (!user)
            return res.status(404).json({ error: "Not found" });
        res.json(user);
    }
    catch (err) {
        res
            .status(500)
            .json({ error: err instanceof Error ? err.message : "Server error" });
    }
}
async function updateUser(req, res) {
    try {
        const updates = req.body;
        const updated = await (0, userService_1.updateUser)(req.params.id, updates);
        res.json(updated);
    }
    catch (err) {
        res
            .status(400)
            .json({ error: err instanceof Error ? err.message : "Update failed" });
    }
}
async function setRole(req, res) {
    try {
        const { role } = req.body;
        if (!role)
            return res.status(400).json({ error: "role required" });
        const updated = await (0, userService_1.setRole)(req.params.id, role);
        res.json(updated);
    }
    catch (err) {
        res
            .status(400)
            .json({ error: err instanceof Error ? err.message : "Set role failed" });
    }
}
async function setStatus(req, res) {
    try {
        const { status } = req.body;
        if (!status)
            return res.status(400).json({ error: "status required" });
        const updated = await (0, userService_1.setStatus)(req.params.id, status);
        res.json(updated);
    }
    catch (err) {
        res
            .status(400)
            .json({
            error: err instanceof Error ? err.message : "Set status failed",
        });
    }
}
async function getAgents(_req, res) {
    try {
        const agents = await (0, userService_1.listAgents)();
        res.json(agents);
    }
    catch (err) {
        res
            .status(500)
            .json({
            error: err instanceof Error ? err.message : "Failed to fetch agents",
        });
    }
}
