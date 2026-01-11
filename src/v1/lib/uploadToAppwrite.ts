// lib/uploadToAppwrite.ts
import FormData from "form-data";
import fs from "fs";
import { ID } from "node-appwrite";
import fetch from "node-fetch";
import { saveTempFile } from "./saveTempFile";

/**
 * Upload a file buffer to Appwrite Storage bucket.
 * @param buffer - File buffer to upload
 * @param filename - Original filename (used for display)
 * @returns Object containing fileId and previewUrl
 */
export async function uploadToAppwriteBucket(
  buffer: Buffer,
  filename: string
): Promise<{ fileId: string; previewUrl: string }> {
  if (!process.env.APPWRITE_ENDPOINT)
    throw new Error("APPWRITE_ENDPOINT not configured");
  if (!process.env.APPWRITE_BUCKET_ID)
    throw new Error("APPWRITE_BUCKET_ID not configured");
  if (!process.env.APPWRITE_PROJECT_ID)
    throw new Error("APPWRITE_PROJECT_ID not configured");
  if (!process.env.APPWRITE_API_KEY)
    throw new Error("APPWRITE_API_KEY not configured");

  const endpoint = process.env.APPWRITE_ENDPOINT.replace(/\/+$/, ""); // trim trailing slash
  const bucketId = process.env.APPWRITE_BUCKET_ID;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  // Save buffer to a temp file
  const tempPath = await saveTempFile(buffer, filename);
  const fileStream = fs.createReadStream(tempPath);

  // Generate a safe fileId using Appwrite SDK helper (ID.unique)
  // This guarantees a valid id format and acceptable length
  const fileId = ID.unique();

  const form = new FormData();
  form.append("fileId", fileId);
  form.append("file", fileStream, filename);

  try {
    const response = await fetch(
      `${endpoint}/storage/buckets/${bucketId}/files`,
      {
        method: "POST",
        headers: {
          "X-Appwrite-Project": projectId,
          "X-Appwrite-Key": apiKey,
          ...form.getHeaders(),
        },
        body: form,
      }
    );

    // explicitly type result as any to avoid 'unknown' errors
    const result: any = await response.json().catch(() => ({}));

    if (!response.ok || !result?.$id) {
      // Prefer structured message if available
      const msg =
        (result && (result.message || result.error)) ||
        (result && Object.keys(result).length
          ? JSON.stringify(result)
          : undefined) ||
        "Upload failed";
      throw new Error(String(msg));
    }

    const returnedId = String(result.$id);
    const previewUrl = `${endpoint}/storage/buckets/${bucketId}/files/${encodeURIComponent(
      returnedId
    )}/preview?project=${encodeURIComponent(projectId)}`;

    return { fileId: returnedId, previewUrl };
  } finally {
    // Clean up temp file (best-effort) and close stream
    try {
      fileStream.close();
    } catch {
      // ignore
    }
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // ignore cleanup errors
    }
  }
}
