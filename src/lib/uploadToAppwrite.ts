import FormData from "form-data";
import fs from "fs";
import fetch from "node-fetch";
import { v4 as uuid } from "uuid";
import { saveTempFile } from "./saveTempFile";

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

  const response = await fetch(
    `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files`,
    {
      method: "POST",
      headers: {
        "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID!,
        "X-Appwrite-Key": process.env.APPWRITE_API_KEY!,
        ...form.getHeaders(),
      },
      body: form,
    }
  );

  // Clean up temp file
  fs.unlinkSync(tempPath);

  const result = (await response.json()) as { $id: string; message?: string };

  if (!response.ok) {
    throw new Error(result.message || "Upload failed");
  }

  const returnedId = result.$id;
  const previewUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${returnedId}/preview?project=${process.env.APPWRITE_PROJECT_ID}`;

  return { fileId: returnedId, previewUrl };
}
