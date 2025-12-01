"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToAppwriteBucket = uploadToAppwriteBucket;
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const saveTempFile_1 = require("./saveTempFile");
async function uploadToAppwriteBucket(buffer, filename) {
    const tempPath = await (0, saveTempFile_1.saveTempFile)(buffer, filename);
    const fileStream = fs_1.default.createReadStream(tempPath);
    const form = new form_data_1.default();
    form.append("fileId", "unique()");
    form.append("file", fileStream, filename);
    const response = await (0, node_fetch_1.default)(`${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files`, {
        method: "POST",
        headers: {
            "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
            "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
            ...form.getHeaders(),
        },
        body: form,
    });
    fs_1.default.unlinkSync(tempPath); // Clean up temp file
    const result = (await response.json());
    if (!response.ok)
        throw new Error(result.message || "Upload failed");
    const fileId = result.$id;
    const previewUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${fileId}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
    return { fileId, previewUrl };
}
