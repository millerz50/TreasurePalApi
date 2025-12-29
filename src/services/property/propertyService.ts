// server/services/property/propertyService.ts
import { ID, Query } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";
import { supabase } from "../../superbase/supabase";
import {
  databases,
  DB_ID,
  PROPERTIES_COLLECTION,
  PROPERTY_MEDIA_COLLECTION,
  storage,
} from "./client";
import { formatProperty } from "./propertyFormatter";
import { buildPropertyPermissions } from "./propertyPermissions";
import { validateAgent } from "./propertyValidation";
import { IMAGE_KEYS, parseCoordinates } from "./utils";

/* --------------------------------- helpers --------------------------------- */

function getErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return JSON.stringify(err);
}

/**
 * Upload images → Storage → property_media collection
 * Returns: { cover: mediaDocId, image1: mediaDocId, ... }
 */
async function uploadPropertyMedia(
  propertyId: string,
  accountId: string,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
): Promise<Record<string, string | null>> {
  const mediaMap: Record<string, string | null> = {};

  for (const key of IMAGE_KEYS) {
    if (!imageFiles?.[key]) {
      mediaMap[key] = null;
      continue;
    }

    const { buffer, name } = imageFiles[key];
    const { fileId } = await uploadToAppwriteBucket(buffer, name);
    const file = await storage.getFile(process.env.APPWRITE_BUCKET_ID!, fileId);

    const mediaDoc = await databases.createDocument(
      DB_ID,
      PROPERTY_MEDIA_COLLECTION,
      ID.unique(),
      {
        propertyId,
        fileId,
        key,
        mimeType: file.mimeType,
        size: file.sizeOriginal,
        createdBy: accountId,
      },
      buildPropertyPermissions(accountId)
    );

    mediaMap[key] = mediaDoc.$id;
  }

  return mediaMap;
}

/* ----------------------------------- CRUD ---------------------------------- */

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

  const media = await databases.listDocuments(
    DB_ID,
    PROPERTY_MEDIA_COLLECTION,
    [Query.equal("propertyId", id)]
  );

  const { data: amenitiesRes } = await supabase
    .from("property_amenities")
    .select("amenities")
    .eq("property_id", id)
    .single();

  return formatProperty({
    ...property,
    media: media.documents,
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
    },
    buildPropertyPermissions(accountId)
  );

  const mediaIds = await uploadPropertyMedia(
    propertyDoc.$id,
    accountId,
    imageFiles
  );

  // Update property document with media IDs
  const updated = await databases.updateDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    propertyDoc.$id,
    mediaIds
  );

  // Save amenities in Supabase
  const amenitiesArray = Array.isArray(payload.amenities)
    ? payload.amenities
    : [];
  await supabase.from("property_amenities").insert({
    property_id: propertyDoc.$id,
    amenities: amenitiesArray,
  });

  return formatProperty({ ...updated, amenities: amenitiesArray });
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

  if (imageFiles) {
    const oldMedia = await databases.listDocuments(
      DB_ID,
      PROPERTY_MEDIA_COLLECTION,
      [Query.equal("propertyId", id)]
    );

    for (const media of oldMedia.documents) {
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, media.fileId);
      await databases.deleteDocument(
        DB_ID,
        PROPERTY_MEDIA_COLLECTION,
        media.$id
      );
    }

    Object.assign(
      updates,
      await uploadPropertyMedia(id, accountId, imageFiles)
    );
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
  });

  // Update amenities in Supabase if provided
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

  const media = await databases.listDocuments(
    DB_ID,
    PROPERTY_MEDIA_COLLECTION,
    [Query.equal("propertyId", id)]
  );

  for (const item of media.documents) {
    await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, item.fileId);
    await databases.deleteDocument(DB_ID, PROPERTY_MEDIA_COLLECTION, item.$id);
  }

  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);

  // Delete amenities from Supabase
  await supabase.from("property_amenities").delete().eq("property_id", id);
}
