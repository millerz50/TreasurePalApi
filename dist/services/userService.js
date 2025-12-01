"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = getUserById;
exports.getUserByAccountId = getUserByAccountId;
exports.listUsers = listUsers;
exports.signupUser = signupUser;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.setRole = setRole;
exports.setStatus = setStatus;
exports.findByEmail = findByEmail;
exports.listAgents = listAgents;
/* eslint-disable @typescript-eslint/no-explicit-any */
const { Client, ID, Query, TablesDB, Users } = require("node-appwrite");
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const tablesDB = new TablesDB(client);
const users = new Users(client);
const DB_ID = process.env.APPWRITE_DATABASE_ID;
const USERS_TABLE = process.env.APPWRITE_USERTABLE_ID || "user";
const DEBUG = process.env.DEBUG === "true";
if (!DB_ID || !USERS_TABLE) {
    throw new Error(`❌ Missing Appwrite config: DB_ID=${DB_ID}, USERS_TABLE=${USERS_TABLE}`);
}
function safeFormat(row) {
    if (!row || typeof row !== "object")
        return null;
    const formatted = { ...row };
    delete formatted.password; // never expose password in responses
    return formatted;
}
function logError(operation, err, context = {}) {
    console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        service: "userService",
        operation,
        context,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
    }));
}
// 🔎 Get by table row ID
async function getUserById(userId) {
    try {
        const row = await tablesDB.getRow(DB_ID, USERS_TABLE, userId);
        return safeFormat(row);
    }
    catch (err) {
        logError("getUserById", err, { userId });
        return null;
    }
}
// 🔎 Get by linked auth user ID (Appwrite accountId)
async function getUserByAccountId(accountid) {
    try {
        const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
            Query.equal("accountid", accountid),
        ]);
        return res.total > 0 ? safeFormat(res.rows[0]) : null;
    }
    catch (err) {
        logError("getUserByAccountId", err, { accountid });
        return null;
    }
}
// 📋 List all users
async function listUsers(limit = 100, offset = 0) {
    try {
        const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [], String(limit));
        const rows = Array.isArray(res.rows) ? res.rows : [];
        const usersList = rows.slice(offset, offset + limit).map(safeFormat);
        return { total: res.total ?? usersList.length, users: usersList };
    }
    catch (err) {
        logError("listUsers", err, { limit, offset });
        return { total: 0, users: [] };
    }
}
// 🆕 Signup: create auth user + profile row
async function signupUser(payload) {
    try {
        // 1. Create auth user (Appwrite) with email + password + name
        // 🚫 Do not send phone to Appwrite
        const authUser = await users.create(ID.unique(), payload.email, payload.password, `${payload.firstName} ${payload.surname}`, null);
        // 2. Create profile row linked to auth user (store phone here only)
        const row = await tablesDB.createRow(DB_ID, USERS_TABLE, ID.unique(), {
            accountid: authUser.$id,
            email: payload.email.toLowerCase(),
            firstName: payload.firstName,
            surname: payload.surname,
            phone: payload.phone ?? null, // ✅ stored only in your DB
            role: payload.role ?? "user",
            status: payload.status ?? "Active",
            password: payload.password, // ⚠️ Ideally remove from schema ASAP
            nationalId: payload.nationalId ?? null,
            bio: payload.bio ?? null,
            metadata: payload.metadata ?? [],
        });
        if (DEBUG)
            console.log("signupUser auth:", authUser, "profile:", row);
        return { authUser, profile: safeFormat(row) };
    }
    catch (err) {
        logError("signupUser", err, { payload });
        throw err;
    }
}
// ✅ Alias for backwards compatibility
async function createUser(payload) {
    return signupUser(payload);
}
// ✏️ Update profile row
async function updateUser(userId, updates) {
    try {
        if ("password" in updates)
            delete updates.password;
        const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, updates);
        return safeFormat(row);
    }
    catch (err) {
        logError("updateUser", err, { userId, updates });
        throw err;
    }
}
// ❌ Delete profile row
async function deleteUser(userId) {
    try {
        return await tablesDB.deleteRow(DB_ID, USERS_TABLE, userId);
    }
    catch (err) {
        logError("deleteUser", err, { userId });
        throw err;
    }
}
// 🔧 Set role
async function setRole(userId, role) {
    try {
        const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, { role });
        return safeFormat(row);
    }
    catch (err) {
        logError("setRole", err, { userId, role });
        throw err;
    }
}
// 🔧 Set status
async function setStatus(userId, status) {
    try {
        const row = await tablesDB.updateRow(DB_ID, USERS_TABLE, userId, {
            status,
        });
        return safeFormat(row);
    }
    catch (err) {
        logError("setStatus", err, { userId, status });
        throw err;
    }
}
// 🔎 Find by email
async function findByEmail(email) {
    try {
        const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [
            Query.equal("email", email.toLowerCase()),
        ]);
        return res.total > 0 ? safeFormat(res.rows[0]) : null;
    }
    catch (err) {
        logError("findByEmail", err, { email });
        return null;
    }
}
// 🔎 List agents (users with role="agent")
async function listAgents(limit = 100, offset = 0) {
    try {
        const res = await tablesDB.listRows(DB_ID, USERS_TABLE, [Query.equal("role", "agent")], String(limit));
        const rows = Array.isArray(res.rows) ? res.rows : [];
        const agentsList = rows.slice(offset, offset + limit).map(safeFormat);
        return { total: res.total ?? agentsList.length, agents: agentsList };
    }
    catch (err) {
        logError("listAgents", err, { limit, offset });
        return { total: 0, agents: [] };
    }
}
