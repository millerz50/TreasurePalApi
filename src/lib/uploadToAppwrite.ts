import FormData from "form-data";
import fs from "fs";
import fetch from "node-fetch";
import { v4 as uuid } from "uuid";
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
  // Save buffer to a temp file
  const tempPath = await saveTempFile(buffer, filename);
  const fileStream = fs.createReadStream(tempPath);

  // Generate a unique fileId
  const fileId = `file-${uuid()}`;

  const form = new FormData();
  form.append("fileId", fileId);
  form.append("file", fileStream, filename);

  const endpoint = process.env.APPWRITE_ENDPOINT!;
  const bucketId = process.env.APPWRITE_BUCKET_ID!;
  const projectId = process.env.APPWRITE_PROJECT_ID!;
  const apiKey = process.env.APPWRITE_API_KEY!;

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

  // Clean up temp file
  try {
    fs.unlinkSync(tempPath);
  } catch {
    // ignore cleanup errors
  }

  const result = (await response.json()) as { $id?: string; message?: string };

  if (!response.ok || !result.$id) {
    throw new Error(result.message || "Upload failed");
  }

  const returnedId = result.$id;
  const previewUrl = `${endpoint}/storage/buckets/${bucketId}/files/${returnedId}/preview?project=${projectId}`;

  return { fileId: returnedId, previewUrl };
}
