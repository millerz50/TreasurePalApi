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

export async function uploadPropertyImages(
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
): Promise<Record<string, string | null>> {
  console.log("🖼 [uploadPropertyImages] Uploading images...");
  const imageIds: Record<string, string | null> = {};
  for (const key of IMAGE_KEYS) {
    if (imageFiles?.[key]) {
      console.log(`➡️ Uploading ${key}...`);
      const { fileId } = await uploadToAppwriteBucket(
        imageFiles[key].buffer,
        imageFiles[key].name
      );
      imageIds[key] = fileId;
      console.log(`✅ Uploaded ${key}:`, fileId);
    } else {
      imageIds[key] = null;
    }
  }
  return imageIds;
}

export async function deletePropertyImages(row: any) {
  console.log(
    "🗑 [deletePropertyImages] Deleting images for property:",
    row?.$id
  );
  for (const key of IMAGE_KEYS) {
    if (row[key]) {
      console.log(`➡️ Deleting ${key}:`, row[key]);
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, row[key]);
    }
  }
  console.log(
    "✅ [deletePropertyImages] Completed cleanup for property:",
    row?.$id
  );
}
