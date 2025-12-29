// server/services/propertyImages.ts
import { Client, Storage } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const storage = new Storage(client);

export const IMAGE_KEYS = [
  "frontElevation",
  "southView",
  "westView",
  "eastView",
  "floorPlan",
] as const;

type ImageFiles = Record<string, { buffer: Buffer; name: string }>;
type ImageIds = Record<string, string | null>;

/**
 * Generate a public Appwrite URL for a fileId
 */
export function getPropertyImageUrl(fileId: string | null): string | null {
  if (!fileId) return null;

  const endpoint = (process.env.APPWRITE_ENDPOINT || "").replace(/\/+$/, "");
  const bucketId = process.env.APPWRITE_BUCKET_ID;
  const projectId = process.env.APPWRITE_PROJECT_ID;

  if (!bucketId || !projectId) return null;

  return `${endpoint}/v1/storage/buckets/${encodeURIComponent(
    bucketId
  )}/files/${encodeURIComponent(fileId)}/view?project=${encodeURIComponent(
    projectId
  )}`;
}

/**
 * Upload property images to Appwrite Storage and return fileIds
 */
export async function uploadPropertyImages(
  imageFiles?: ImageFiles
): Promise<ImageIds> {
  console.log("🖼 [uploadPropertyImages] Starting upload...");

  const imageIds: ImageIds = {};

  for (const key of IMAGE_KEYS) {
    if (!imageFiles?.[key]) {
      imageIds[key] = null;
      console.log(`⚠️ No file provided for ${key}`);
      continue;
    }

    try {
      console.log(`➡️ Uploading ${key}...`);
      const { fileId } = await uploadToAppwriteBucket(
        imageFiles[key].buffer,
        imageFiles[key].name
      );

      imageIds[key] = fileId;
      console.log(`✅ Uploaded ${key}, fileId =`, fileId);
    } catch (err) {
      console.error(`❌ Failed to upload ${key}:`, err);
      imageIds[key] = null;
    }
  }

  console.log("✅ [uploadPropertyImages] Finished uploading images.");
  return imageIds;
}

/**
 * Delete property images from Appwrite Storage
 */
export async function deletePropertyImages(imageIds: ImageIds) {
  console.log("🗑 [deletePropertyImages] Starting deletion...");

  for (const key of IMAGE_KEYS) {
    const fileId = imageIds[key];
    if (!fileId) {
      console.log(`⚠️ No fileId found for ${key}, skipping`);
      continue;
    }

    try {
      console.log(`➡️ Deleting ${key}, fileId =`, fileId);
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, fileId);
      console.log(`✅ Deleted ${key}`);
    } catch (err) {
      console.error(`❌ Failed to delete ${key}:`, err);
    }
  }

  console.log("✅ [deletePropertyImages] Completed deletion.");
}

/**
 * Get the public URL for a single property image by fileId
 */
export function getPropertyImageSignedUrl(
  fileId: string | null
): string | null {
  if (!fileId) return null;
  try {
    return getPropertyImageUrl(fileId);
  } catch (err) {
    console.error("❌ Failed to generate signed URL:", err);
    return null;
  }
}
