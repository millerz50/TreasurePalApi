"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProperties = listProperties;
exports.getPropertyById = getPropertyById;
exports.createProperty = createProperty;
exports.updateProperty = updateProperty;
exports.deleteProperty = deleteProperty;
const node_appwrite_1 = require("node-appwrite");
const uploadToAppwrite_1 = require("../../lib/uploadToAppwrite");
const client_1 = require("./client");
const formatters_1 = require("./formatters");
const utils_1 = require("./utils");
async function listProperties(limit = 100) {
    const res = await client_1.tablesDB.listRows(client_1.DB_ID, client_1.PROPERTIES_TABLE, [], String(limit));
    return res.rows.map(formatters_1.formatProperty);
}
async function getPropertyById(id) {
    const row = await client_1.tablesDB.getRow(client_1.DB_ID, client_1.PROPERTIES_TABLE, id);
    return (0, formatters_1.formatProperty)(row);
}
async function createProperty(payload, imageFiles) {
    // validate agent
    const agentRes = await client_1.tablesDB.listRows(client_1.DB_ID, client_1.USERS_TABLE, [
        node_appwrite_1.Query.equal("accountid", String(payload.agentId)),
    ]);
    const agentDoc = agentRes.total > 0 ? agentRes.rows[0] : null;
    if (!agentDoc || agentDoc.role !== "agent")
        throw new Error("Invalid agentId or user is not an agent");
    const coords = (0, utils_1.parseCoordinates)(payload.coordinates);
    const imageIds = {};
    if (imageFiles) {
        for (const key of utils_1.IMAGE_KEYS) {
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
        amenities: (0, utils_1.toCsv)(payload.amenities),
        ...coords,
        agentId: String(payload.agentId),
        published: false,
        approvedBy: null,
        approvedAt: null,
        // deposit
        depositAvailable: !!payload.depositAvailable,
        depositOption: payload.depositOption || "none",
        depositPercentage: payload.depositPercentage || null,
        // marketing
        website: payload.website || "",
        flyers: payload.flyers || "",
        hireDesigner: !!payload.hireDesigner,
        designerId: payload.designerId || null,
        subscriptionPlan: payload.subscriptionPlan || "free",
        whatsappGroup: payload.whatsappGroup || "",
        ads: payload.ads || "",
        ...imageIds,
    };
    const permissions = [
        node_appwrite_1.Permission.read(node_appwrite_1.Role.user(payload.agentId)),
        node_appwrite_1.Permission.update(node_appwrite_1.Role.user(payload.agentId)),
        node_appwrite_1.Permission.delete(node_appwrite_1.Role.user(payload.agentId)),
        node_appwrite_1.Permission.read(node_appwrite_1.Role.any()),
        node_appwrite_1.Permission.update(node_appwrite_1.Role.team("admins")),
        node_appwrite_1.Permission.delete(node_appwrite_1.Role.team("admins")),
    ];
    const row = await client_1.tablesDB.createRow(client_1.DB_ID, client_1.PROPERTIES_TABLE, node_appwrite_1.ID.unique(), record, permissions);
    return (0, formatters_1.formatProperty)(row);
}
async function updateProperty(id, updates, imageFiles) {
    const coords = (0, utils_1.parseCoordinates)(updates.coordinates);
    const imageIds = {};
    if (imageFiles) {
        for (const key of utils_1.IMAGE_KEYS) {
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
            amenities: (0, utils_1.toCsv)(updates.amenities),
        }),
        ...coords,
        ...(updates.agentId !== undefined && { agentId: String(updates.agentId) }),
        // deposit
        ...(updates.depositAvailable !== undefined && {
            depositAvailable: !!updates.depositAvailable,
        }),
        ...(updates.depositOption !== undefined && {
            depositOption: updates.depositOption,
        }),
        ...(updates.depositPercentage !== undefined && {
            depositPercentage: updates.depositPercentage,
        }),
        // marketing
        ...(updates.website !== undefined && { website: updates.website }),
        ...(updates.flyers !== undefined && { flyers: updates.flyers }),
        ...(updates.hireDesigner !== undefined && {
            hireDesigner: !!updates.hireDesigner,
        }),
        ...(updates.designerId !== undefined && { designerId: updates.designerId }),
        ...(updates.subscriptionPlan !== undefined && {
            subscriptionPlan: updates.subscriptionPlan,
        }),
        ...(updates.whatsappGroup !== undefined && {
            whatsappGroup: updates.whatsappGroup,
        }),
        ...(updates.ads !== undefined && { ads: updates.ads }),
        ...imageIds,
    };
    const row = await client_1.tablesDB.updateRow(client_1.DB_ID, client_1.PROPERTIES_TABLE, id, payload);
    return (0, formatters_1.formatProperty)(row);
}
async function deleteProperty(id) {
    const row = await client_1.tablesDB.getRow(client_1.DB_ID, client_1.PROPERTIES_TABLE, id);
    for (const key of utils_1.IMAGE_KEYS) {
        if (row[key]) {
            await client_1.storage.deleteFile(process.env.APPWRITE_BUCKET_ID, row[key]);
        }
    }
    await client_1.tablesDB.deleteRow(client_1.DB_ID, client_1.PROPERTIES_TABLE, id);
}
