"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupUser = signupUser;
exports.createUser = createUser;
exports.getUserById = getUserById;
exports.getUserByAccountId = getUserByAccountId;
exports.findByEmail = findByEmail;
exports.listUsers = listUsers;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.setRole = setRole;
exports.setStatus = setStatus;
exports.listAgents = listAgents;
/* lib/users.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */
const node_appwrite_1 = require("node-appwrite");
/* ------------------------------------------
    ENV + CLIENT
------------------------------------------- */
function getEnv(key, fallback) {
    const v = process.env[key];
    return v && v.length > 0 ? v : fallback;
}
function requireEnv(key) {
    const v = getEnv(key);
    if (!v)
        throw new Error(`Missing required env var: ${key}`);
    return v;
}
let _client = null;
function getClient() {
    if (_client)
        return _client;
    _client = new node_appwrite_1.Client()
        .setEndpoint(requireEnv("APPWRITE_ENDPOINT"))
        .setProject(requireEnv("APPWRITE_PROJECT_ID"))
        .setKey(requireEnv("APPWRITE_API_KEY"));
    return _client;
}
function getTablesDB() {
    return new node_appwrite_1.TablesDB(getClient());
}
/* ------------------------------------------
    CONSTANTS
------------------------------------------- */
const DB_ID = getEnv("APPWRITE_DATABASE_ID") ?? "";
const USERS_TABLE = getEnv("APPWRITE_USERTABLE_ID") || "user";
const DEBUG = getEnv("DEBUG") === "true";
if (!DB_ID)
    console.warn("Warning: APPWRITE_DATABASE_ID missing");
function safeFormat(row) {
    if (!row || typeof row !== "object")
        return null;
    const f = { ...row };
    if ("password" in f)
        delete f.password;
    return f;
}
function logStep(step, data) {
    if (DEBUG)
        console.log("DEBUG:", step, data ?? "");
}
function logError(operation, err, ctx = {}) {
    console.error(JSON.stringify({
        time: new Date().toISOString(),
        operation,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        ctx,
    }));
}
async function signupUser(payload) {
    logStep("START signupUser", { email: payload.email });
    const tablesDB = getTablesDB();
    const normalizedEmail = payload.email.toLowerCase().trim();
    const accountId = payload.accountId ?? node_appwrite_1.ID.unique();
    // Prevent duplicates by email
    const existing = await findByEmail(normalizedEmail).catch(() => null);
    if (existing) {
        const error = new Error("User already exists with this email.");
        error.status = 409;
        throw error;
    }
    // Build the row payload
    const rowPayload = {
        accountid: accountId,
        email: normalizedEmail,
        firstName: payload.firstName,
        surname: payload.surname,
        country: payload.country ?? null,
        location: payload.location ?? null,
        role: payload.role ?? "user",
        status: payload.status ?? "Active",
        nationalId: payload.nationalId ?? null,
        bio: payload.bio ?? null,
        metadata: Array.isArray(payload.metadata) ? payload.metadata : [],
        dateOfBirth: payload.dateOfBirth ?? null,
        agentId: node_appwrite_1.ID.unique(),
    };
    try {
        const createdRow = await tablesDB.createRow(DB_ID, USERS_TABLE, node_appwrite_1.ID.unique(), rowPayload, [
            node_appwrite_1.Permission.read(node_appwrite_1.Role.any()), // readable
            node_appwrite_1.Permission.update(node_appwrite_1.Role.any()),
            node_appwrite_1.Permission.delete(node_appwrite_1.Role.any()),
        ]);
        logStep("DB row created", {
            profileId: createdRow.$id,
            accountId,
        });
        return {
            status: "SUCCESS",
            userId: accountId,
            profileId: createdRow.$id,
            profile: safeFormat(createdRow),
        };
    }
    catch (err) {
        logError("signupUser.createRow", err, { email: normalizedEmail });
        throw err;
    }
}
/* ------------------------------------------
    createUser compatibility wrapper
------------------------------------------- */
async function createUser(p) {
    return signupUser(p);
}
/* ------------------------------------------
    GETTERS
------------------------------------------- */
async function getUserById(id) {
    try {
        const row = await getTablesDB().getRow(DB_ID, USERS_TABLE, id);
        return safeFormat(row);
    }
    catch (err) {
        logError("getUserById", err, { id });
        return null;
    }
}
async function getUserByAccountId(accountid) {
    try {
        const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
            node_appwrite_1.Query.equal("accountid", accountid),
        ]);
        return res.total > 0 ? safeFormat(res.rows[0]) : null;
    }
    catch (err) {
        logError("getUserByAccountId", err, { accountid });
        return null;
    }
}
async function findByEmail(email) {
    try {
        const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [
            node_appwrite_1.Query.equal("email", email.toLowerCase()),
        ]);
        return res.total > 0 ? safeFormat(res.rows[0]) : null;
    }
    catch (err) {
        logError("findByEmail", err, { email });
        return null;
    }
}
/* ------------------------------------------
    LIST
------------------------------------------- */
async function listUsers(limit = 100, offset = 0) {
    try {
        const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [], String(limit));
        const rows = res.rows ?? [];
        return {
            total: res.total ?? rows.length,
            users: rows.slice(offset, offset + limit).map(safeFormat),
        };
    }
    catch (err) {
        logError("listUsers", err, { limit, offset });
        return { total: 0, users: [] };
    }
}
/* ------------------------------------------
    UPDATE / DELETE
------------------------------------------- */
async function updateUser(id, updates) {
    try {
        if ("password" in updates)
            delete updates.password;
        const row = await getTablesDB().updateRow(DB_ID, USERS_TABLE, id, updates);
        return safeFormat(row);
    }
    catch (err) {
        logError("updateUser", err, { id, updates });
        throw err;
    }
}
async function deleteUser(id) {
    try {
        return await getTablesDB().deleteRow(DB_ID, USERS_TABLE, id);
    }
    catch (err) {
        logError("deleteUser", err, { id });
        throw err;
    }
}
/* ------------------------------------------
    AGENTS
------------------------------------------- */
async function setRole(id, role) {
    try {
        const row = await getTablesDB().updateRow(DB_ID, USERS_TABLE, id, { role });
        return safeFormat(row);
    }
    catch (err) {
        logError("setRole", err, { id, role });
        throw err;
    }
}
async function setStatus(id, status) {
    try {
        const row = await getTablesDB().updateRow(DB_ID, USERS_TABLE, id, {
            status,
        });
        return safeFormat(row);
    }
    catch (err) {
        logError("setStatus", err, { id, status });
        throw err;
    }
}
async function listAgents(limit = 100, offset = 0) {
    try {
        const res = await getTablesDB().listRows(DB_ID, USERS_TABLE, [node_appwrite_1.Query.equal("role", "agent")], String(limit));
        const rows = res.rows ?? [];
        return {
            total: res.total ?? rows.length,
            agents: rows.slice(offset, offset + limit).map(safeFormat),
        };
    }
    catch (err) {
        logError("listAgents", err, { limit, offset });
        return { total: 0, agents: [] };
    }
}
