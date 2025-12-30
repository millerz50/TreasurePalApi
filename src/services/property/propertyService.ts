// server/services/property/propertyService.ts
import { ID } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";
import { supabase } from "../../superbase/supabase";
import { databases, DB_ID, PROPERTIES_COLLECTION, storage } from "./client";
import { buildPropertyPermissions } from "./propertyPermissions";
import { validateAgent } from "./propertyValidation";
import { IMAGE_KEYS, parseCoordinates } from "./utils";

/* ------------------------------- helpers --------------------------------- */

function getErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return JSON.stringify(err);
}

/**
 * Upload images → Storage
 * Returns: { frontElevation: fileId, southView: fileId, ... }
 */
async function uploadPropertyImages(
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
): Promise<Record<string, string | null>> {
  const images: Record<string, string | null> = {};

  for (const key of IMAGE_KEYS) {
    if (!imageFiles?.[key]) {
      images[key] = null;
      continue;
    }

    const { buffer, name } = imageFiles[key];
    try {
      const { fileId } = await uploadToAppwriteBucket(buffer, name);
      images[key] = fileId;
    } catch (err) {
      console.error(`Failed to upload ${key}:`, getErrorMessage(err));
      images[key] = null;
    }
  }

  return images;
}

/**
 * Normalize raw Appwrite doc → wrap image IDs into `images` object
 */
function formatProperty(doc: any) {
  const images: Record<string, string | null> = {};
  for (const key of IMAGE_KEYS) {
    images[key] = doc[key] ?? null;
  }

  return {
    ...doc,
    images,
  };
}

/* ------------------------------- CRUD ----------------------------------- */

export async function listProperties(limit = 100) {
  const res = await databases.listDocuments(
    DB_ID,
    PROPERTIES_COLLECTION,
    [],
    String(limit)
  );

  const formatted = await Promise.all(
    res.documents.map(async (doc) => {
      const { data: amenitiesRes } = await supabase
        .from("property_amenities")
        .select("amenities")
        .eq("property_id", doc.$id)
        .single();

      return formatProperty({
        ...doc,
        amenities: amenitiesRes?.amenities || [],
      });
    })
  );

  return formatted;
}

export async function getPropertyById(id: string) {
  const property = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );

  const { data: amenitiesRes } = await supabase
    .from("property_amenities")
    .select("amenities")
    .eq("property_id", id)
    .single();

  return formatProperty({
    ...property,
    amenities: amenitiesRes?.amenities || [],
  });
}

/** Create property (agent only) */
export async function createProperty(
  payload: any,
  accountId: string,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  await validateAgent(accountId);

  const coords = parseCoordinates(payload.coordinates);

  // Upload images and get fileIds
  const images = await uploadPropertyImages(imageFiles);

  const propertyDoc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    {
      title: payload.title ?? "",
      price: payload.price ? Number(payload.price) : 0,
      location: payload.location ?? "",
      address: payload.address ?? "",
      rooms: payload.rooms ? Number(payload.rooms) : 0,
      description: payload.description ?? "",
      type: payload.type ?? "",
      status: "pending",
      country: payload.country ?? "",
      ...coords,
      agentId: accountId,
      published: false,
      approvedBy: null,
      approvedAt: null,
      url: payload.url ?? `/properties/${ID.unique()}`,
      ...images, // store only fileIds at top level
    },
    buildPropertyPermissions(accountId)
  );

  // Store amenities in Supabase
  const amenitiesArray = Array.isArray(payload.amenities)
    ? payload.amenities
    : [];
  await supabase.from("property_amenities").insert({
    property_id: propertyDoc.$id,
    amenities: amenitiesArray,
  });

  return formatProperty({ ...propertyDoc, amenities: amenitiesArray });
}

/** Update property */
export async function updateProperty(
  id: string,
  updates: any,
  accountId: string,
  isAdmin = false,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );

  if (!isAdmin && existing.agentId !== accountId) {
    throw new Error("Not authorized");
  }

  const coords = parseCoordinates(updates.coordinates);

  // Upload new images if provided
  let images: Record<string, string | null> = {};
  if (imageFiles) {
    images = await uploadPropertyImages(imageFiles);
  }

  const doc = await databases.updateDocument(DB_ID, PROPERTIES_COLLECTION, id, {
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.price !== undefined && { price: Number(updates.price) }),
    ...(updates.location !== undefined && { location: updates.location }),
    ...(updates.address !== undefined && { address: updates.address }),
    ...(updates.rooms !== undefined && { rooms: Number(updates.rooms) }),
    ...(updates.description !== undefined && {
      description: updates.description,
    }),
    ...(updates.type !== undefined && { type: updates.type }),
    ...(updates.status !== undefined && { status: updates.status }),
    ...(updates.country !== undefined && { country: updates.country }),
    ...coords,
    ...images,
  });

  // Update amenities in Supabase
  if (updates.amenities) {
    const amenitiesArray = Array.isArray(updates.amenities)
      ? updates.amenities
      : [];
    await supabase.from("property_amenities").upsert({
      property_id: id,
      amenities: amenitiesArray,
    });
    updates.amenities = amenitiesArray;
  } else {
    const { data: amenitiesRes } = await supabase
      .from("property_amenities")
      .select("amenities")
      .eq("property_id", id)
      .single();
    updates.amenities = amenitiesRes?.amenities || [];
  }

  return formatProperty({ ...doc, amenities: updates.amenities });
}

/** Delete property */
export async function deleteProperty(
  id: string,
  accountId: string,
  isAdmin = false
) {
  const property = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );

  if (!isAdmin && property.agentId !== accountId) {
    throw new Error("Not authorized");
  }

  // Delete images from Appwrite storage
  for (const key of IMAGE_KEYS) {
    if (property[key]) {
      const fileId = property[key]; // fileId is stored directly
      if (fileId)
        await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, fileId);
    }
  }

  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);

  // Delete amenities from Supabase
  await supabase.from("property_amenities").delete().eq("property_id", id);
}
