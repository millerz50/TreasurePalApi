"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToAppwriteBucket = uploadToAppwriteBucket;
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const uuid_1 = require("uuid");
const saveTempFile_1 = require("./saveTempFile");
/**
 * Upload a file buffer to Appwrite Storage bucket.
 * @param buffer - File buffer to upload
 * @param filename - Original filename (used for display)
 * @returns Object containing fileId and previewUrl
 */
async function uploadToAppwriteBucket(buffer, filename) {
    // Save buffer to a temp file
    const tempPath = await (0, saveTempFile_1.saveTempFile)(buffer, filename);
    const fileStream = fs_1.default.createReadStream(tempPath);
    // Generate a unique fileId
    const fileId = `file-${(0, uuid_1.v4)()}`;
    const form = new form_data_1.default();
    form.append("fileId", fileId);
    form.append("file", fileStream, filename);
    const endpoint = process.env.APPWRITE_ENDPOINT;
    const bucketId = process.env.APPWRITE_BUCKET_ID;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    const response = await (0, node_fetch_1.default)(`${endpoint}/storage/buckets/${bucketId}/files`, {
        method: "POST",
        headers: {
            "X-Appwrite-Project": projectId,
            "X-Appwrite-Key": apiKey,
            ...form.getHeaders(),
        },
        body: form,
    });
    // Clean up temp file
    try {
        fs_1.default.unlinkSync(tempPath);
    }
    catch {
        // ignore cleanup errors
    }
    const result = (await response.json());
    if (!response.ok || !result.$id) {
        throw new Error(result.message || "Upload failed");
    }
    const returnedId = result.$id;
    const previewUrl = `${endpoint}/storage/buckets/${bucketId}/files/${returnedId}/preview?project=${projectId}`;
    return { fileId: returnedId, previewUrl };
}
