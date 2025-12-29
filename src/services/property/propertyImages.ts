import { Client, Storage } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";
import { supabase } from "../../superbase/supabase";

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
 * Upload property images to Appwrite Storage and return file IDs.
 * Optionally, track URLs in Supabase (recommended).
 */
export async function uploadPropertyImages(
  propertyId: string,
  imageFiles?: ImageFiles,
  saveToSupabase = true
): Promise<ImageIds> {
  console.log("🖼 [uploadPropertyImages] Uploading images...");

  const imageIds: ImageIds = {};

  for (const key of IMAGE_KEYS) {
    if (!imageFiles?.[key]) {
      imageIds[key] = null;
      continue;
    }

    console.log(`➡️ Uploading ${key}...`);
    // Upload to Appwrite and get fileId
    const { fileId } = await uploadToAppwriteBucket(
      imageFiles[key].buffer,
      imageFiles[key].name
    );

    imageIds[key] = fileId;

    console.log(`✅ Uploaded ${key}: fileId =`, fileId);

    // Optional: save public URL in Supabase for tracking
    if (saveToSupabase) {
      const url = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${fileId}/view`;
      await supabase.from("property_images").upsert({
        property_id: propertyId,
        key,
        url,
        file_id: fileId,
      });
    }
  }

  return imageIds;
}

/**
 * Delete property images from Appwrite Storage and optionally Supabase.
 */
export async function deletePropertyImages(
  propertyId: string,
  imageIds: ImageIds,
  deleteFromSupabase = true
) {
  console.log(
    "🗑 [deletePropertyImages] Deleting images for property:",
    propertyId
  );

  for (const key of IMAGE_KEYS) {
    const fileId = imageIds[key];
    if (!fileId) continue;

    console.log(`➡️ Deleting ${key}: fileId =`, fileId);
    await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, fileId);

    if (deleteFromSupabase) {
      await supabase
        .from("property_images")
        .delete()
        .eq("property_id", propertyId)
        .eq("key", key);
    }
  }

  console.log(
    "✅ [deletePropertyImages] Completed cleanup for property:",
    propertyId
  );
}
