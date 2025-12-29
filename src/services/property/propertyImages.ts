// server/services/propertyImages.ts
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
type ImageUrls = Record<string, string | null>;

/**
 * Upload property images to Appwrite Storage and return public URLs.
 * Optionally, store URLs in Supabase table "property_images".
 */
export async function uploadPropertyImages(
  propertyId: string,
  imageFiles?: ImageFiles,
  saveToSupabase = true
): Promise<ImageUrls> {
  console.log("🖼 [uploadPropertyImages] Uploading images...");

  const imageUrls: ImageUrls = {};

  for (const key of IMAGE_KEYS) {
    if (!imageFiles?.[key]) {
      imageUrls[key] = null;
      continue;
    }

    console.log(`➡️ Uploading ${key}...`);
    // Upload to Appwrite
    const { fileId } = await uploadToAppwriteBucket(
      imageFiles[key].buffer,
      imageFiles[key].name
    );

    // Construct public URL
    const url = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${fileId}/view`;
    imageUrls[key] = url;

    console.log(`✅ Uploaded ${key}:`, url);

    // Optional: save to Supabase for image tracking
    if (saveToSupabase) {
      await supabase.from("property_images").upsert({
        property_id: propertyId,
        key,
        url,
      });
    }
  }

  return imageUrls;
}

/**
 * Delete property images from Appwrite Storage and optionally from Supabase.
 */
export async function deletePropertyImages(
  propertyId: string,
  images: ImageUrls,
  deleteFromSupabase = true
) {
  console.log(
    "🗑 [deletePropertyImages] Deleting images for property:",
    propertyId
  );

  for (const key of IMAGE_KEYS) {
    const url = images[key];
    if (!url) continue;

    const fileId = url.split("/").pop()!;
    console.log(`➡️ Deleting ${key}:`, fileId);

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
