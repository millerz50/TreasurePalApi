"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProperties = listProperties;
exports.getPropertyById = getPropertyById;
exports.createProperty = createProperty;
exports.updateProperty = updateProperty;
exports.deleteProperty = deleteProperty;
const node_appwrite_1 = require("node-appwrite");
const uploadToAppwrite_1 = require("../lib/uploadToAppwrite");
function getPreviewUrl(fileId) {
    if (!fileId)
        return null;
    const endpointRaw = process.env.APPWRITE_ENDPOINT;
    const endpoint = endpointRaw.endsWith("/v1")
        ? endpointRaw.replace(/\/$/, "")
        : endpointRaw.replace(/\/$/, "") + "/v1";
    const bucketId = process.env.APPWRITE_BUCKET_ID;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${projectId}`;
}
const client = new node_appwrite_1.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const tablesDB = new node_appwrite_1.TablesDB(client);
const storage = new node_appwrite_1.Storage(client);
const DB_ID = process.env.APPWRITE_DATABASE_ID;
const PROPERTIES_TABLE = process.env.APPWRITE_PROPERTIES_COLLECTION_ID || "properties";
const USERS_TABLE = process.env.APPWRITE_USERS_COLLECTION_ID || "users";
const IMAGE_KEYS = [
    "frontElevation",
    "southView",
    "westView",
    "eastView",
    "floorPlan",
];
function toCsv(value) {
    if (!value)
        return "";
    if (Array.isArray(value))
        return value
            .map(String)
            .map((s) => s.trim())
            .filter(Boolean)
            .join(",");
    return String(value).trim();
}
function fromCsv(value) {
    if (!value)
        return [];
    return String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}
function parseCoordinates(value) {
    if (!value)
        return {};
    if (Array.isArray(value) && value.length >= 2) {
        const lat = Number(value[0]);
        const lng = Number(value[1]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng))
            return { locationLat: lat, locationLng: lng };
        return {};
    }
    if (typeof value === "string" && value.includes(",")) {
        const [latS, lngS] = value.split(",");
        const lat = Number(latS);
        const lng = Number(lngS);
        if (!Number.isNaN(lat) && !Number.isNaN(lng))
            return { locationLat: lat, locationLng: lng };
    }
    return {};
}
function formatProperty(row) {
    const base = {
        $id: row.$id,
        title: row.title,
        price: row.price,
        location: row.location,
        address: row.address,
        rooms: typeof row.rooms === "number" ? row.rooms : Number(row.rooms || 0),
        description: row.description || "",
        type: row.type || "",
        status: row.status || "pending",
        country: row.country || "",
        amenities: fromCsv(row.amenities),
        locationLat: row.locationLat !== undefined ? Number(row.locationLat) : null,
        locationLng: row.locationLng !== undefined ? Number(row.locationLng) : null,
        agentId: row.agentId,
        published: !!row.published,
        approvedBy: row.approvedBy || null,
        approvedAt: row.approvedAt || null,
        createdAt: row.$createdAt,
        updatedAt: row.$updatedAt,
    };
    const images = {};
    IMAGE_KEYS.forEach((key) => {
        const fileId = row[key] || null;
        images[key] = { fileId, previewUrl: getPreviewUrl(fileId) };
    });
    return { ...base, images };
}
async function listProperties(limit = 100) {
    const res = await tablesDB.listRows(DB_ID, PROPERTIES_TABLE, [], String(limit));
    return res.rows.map(formatProperty);
}
async function getPropertyById(id) {
    const row = await tablesDB.getRow(DB_ID, PROPERTIES_TABLE, id);
    return formatProperty(row);
}
async function createProperty(payload, imageFiles) {
    const agentRes = await tablesDB.listRows(DB_ID, USERS_TABLE, [
        node_appwrite_1.Query.equal("$id", String(payload.agentId)),
    ]);
    const agentDoc = agentRes.total > 0 ? agentRes.rows[0] : null;
    if (!agentDoc || agentDoc.role !== "agent")
        throw new Error("Invalid agentId or user is not an agent");
    const coords = parseCoordinates(payload.coordinates);
    const imageIds = {};
    if (imageFiles) {
        for (const key of IMAGE_KEYS) {
            if (imageFiles[key]) {
                const { fileId } = await (0, uploadToAppwrite_1.uploadToAppwriteBucket)(imageFiles[key].buffer, imageFiles[key].name);
                imageIds[key] = fileId;
            }
            else {
                imageIds[key] = null;
            }
        }
    }
    const record = {
        title: payload.title,
        price: payload.price,
        location: payload.location,
        address: payload.address,
        rooms: payload.rooms ? Number(payload.rooms) : 0,
        description: payload.description || "",
        type: payload.type || "",
        status: payload.status || "pending",
        country: payload.country || "",
        amenities: toCsv(payload.amenities),
        ...coords,
        agentId: String(payload.agentId),
        published: false,
        approvedBy: null,
        approvedAt: null,
        ...imageIds,
    };
    // ✅ Permissions: agent + optional public + admins team
    const permissions = [
        node_appwrite_1.Permission.read(node_appwrite_1.Role.user(payload.agentId)),
        node_appwrite_1.Permission.update(node_appwrite_1.Role.user(payload.agentId)),
        node_appwrite_1.Permission.delete(node_appwrite_1.Role.user(payload.agentId)),
        node_appwrite_1.Permission.read(node_appwrite_1.Role.any()), // optional: allow public read
        node_appwrite_1.Permission.update(node_appwrite_1.Role.team("admins")), // if you have an "admins" team
        node_appwrite_1.Permission.delete(node_appwrite_1.Role.team("admins")),
    ];
    const row = await tablesDB.createRow(DB_ID, PROPERTIES_TABLE, node_appwrite_1.ID.unique(), record, permissions);
    return formatProperty(row);
}
async function updateProperty(id, updates, imageFiles) {
    const coords = parseCoordinates(updates.coordinates);
    const imageIds = {};
    if (imageFiles) {
        for (const key of IMAGE_KEYS) {
            if (imageFiles[key]) {
                const { fileId } = await (0, uploadToAppwrite_1.uploadToAppwriteBucket)(imageFiles[key].buffer, imageFiles[key].name);
                imageIds[key] = fileId;
            }
        }
    }
    const payload = {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.price !== undefined && { price: updates.price }),
        ...(updates.location !== undefined && { location: updates.location }),
        ...(updates.address !== undefined && { address: updates.address }),
        ...(updates.rooms !== undefined && { rooms: Number(updates.rooms) }),
        ...(updates.description !== undefined && {
            description: updates.description,
        }),
        ...(updates.type !== undefined && { type: updates.type }),
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.country !== undefined && { country: updates.country }),
        ...(updates.amenities !== undefined && {
            amenities: toCsv(updates.amenities),
        }),
        ...coords,
        ...(updates.agentId !== undefined && { agentId: String(updates.agentId) }),
        ...imageIds,
    };
    const row = await tablesDB.updateRow(DB_ID, PROPERTIES_TABLE, id, payload);
    return formatProperty(row);
}
async function deleteProperty(id) {
    const row = await tablesDB.getRow(DB_ID, PROPERTIES_TABLE, id);
    for (const key of IMAGE_KEYS) {
        if (row[key]) {
            await storage.deleteFile(process.env.APPWRITE_BUCKET_ID, row[key]);
        }
    }
    await tablesDB.deleteRow(DB_ID, PROPERTIES_TABLE, id);
}
