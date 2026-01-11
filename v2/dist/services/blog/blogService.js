"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlog = createBlog;
exports.getPublishedBlogs = getPublishedBlogs;
exports.getBlogById = getBlogById;
exports.updateBlog = updateBlog;
exports.deleteBlog = deleteBlog;
exports.publishBlog = publishBlog;
const node_appwrite_1 = require("node-appwrite");
const uploadToAppwrite_1 = require("../../lib/uploadToAppwrite");
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
const BLOGS_TABLE = process.env.APPWRITE_BLOGS_TABLE_ID || "blogs";
const IMAGE_KEYS = ["coverImage", "thumbnail"];
function formatBlog(row) {
    const base = {
        $id: row.$id,
        title: row.title,
        content: row.content,
        authorId: row.authorId,
        authorRole: row.authorRole,
        status: row.status || "draft",
        createdAt: row.$createdAt,
        updatedAt: row.$updatedAt,
    };
    const images = {};
    IMAGE_KEYS.forEach((key) => {
        const fileId = row[key] || null;
        images[key] = {
            fileId,
            previewUrl: getPreviewUrl(fileId),
        };
    });
    return { ...base, images };
}
// ✅ Create blog (always draft, with optional images)
async function createBlog(payload, imageFiles) {
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
        content: payload.content,
        authorId: payload.authorId,
        authorRole: payload.authorRole,
        status: "draft",
        ...imageIds,
    };
    const row = await tablesDB.createRow(DB_ID, BLOGS_TABLE, node_appwrite_1.ID.unique(), record);
    return formatBlog(row);
}
// ✅ Get all published blogs
async function getPublishedBlogs(limit = 50) {
    const res = await tablesDB.listRows(DB_ID, BLOGS_TABLE, [node_appwrite_1.Query.equal("status", "published")], // ✅ use Query helper
    String(limit));
    return res.rows.map(formatBlog);
}
// ✅ Get blog by ID
async function getBlogById(id) {
    const row = await tablesDB.getRow(DB_ID, BLOGS_TABLE, id);
    return formatBlog(row);
}
// ✅ Update blog (author or admin)
async function updateBlog(id, updates, imageFiles) {
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
        ...(updates.content !== undefined && { content: updates.content }),
        ...(updates.authorId !== undefined && { authorId: updates.authorId }),
        ...(updates.authorRole !== undefined && { authorRole: updates.authorRole }),
        ...(updates.status !== undefined && { status: updates.status }),
        ...imageIds,
    };
    const row = await tablesDB.updateRow(DB_ID, BLOGS_TABLE, id, payload);
    return formatBlog(row);
}
// ✅ Delete blog (author or admin)
async function deleteBlog(id) {
    const row = await tablesDB.getRow(DB_ID, BLOGS_TABLE, id);
    for (const key of IMAGE_KEYS) {
        if (row[key]) {
            await storage.deleteFile(process.env.APPWRITE_BUCKET_ID, row[key]);
        }
    }
    await tablesDB.deleteRow(DB_ID, BLOGS_TABLE, id);
}
// ✅ Admin publish
async function publishBlog(id) {
    const row = await tablesDB.updateRow(DB_ID, BLOGS_TABLE, id, {
        status: "published",
    });
    return formatBlog(row);
}
