// server/services/propertyService.ts
import { ID, Query } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";
import { supabase } from "../../superbase/supabase";
import {
  DB_ID,
  PROPERTIES_COLLECTION,
  USERS_COLLECTION,
  databases,
  storage,
} from "./client";
import { formatProperty } from "./formatters";
import { IMAGE_KEYS, parseCoordinates } from "./utils";

/** -------------------- CRUD -------------------- */

/** List properties (public) */
export async function listProperties(limit = 100) {
  const res = await databases.listDocuments(
    DB_ID,
    PROPERTIES_COLLECTION,
    [],
    String(limit)
  );

  // Fetch amenities from Supabase
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

/** Get a property by ID (public) */
export async function getPropertyById(id: string) {
  const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);

  const { data: amenitiesRes } = await supabase
    .from("property_amenities")
    .select("amenities")
    .eq("property_id", id)
    .single();

  return formatProperty({
    ...doc,
    amenities: amenitiesRes?.amenities || [],
  });
}

/** Create a property (agent) */
export async function createProperty(
  payload: any,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  // ✅ Validate agent
  const agentRes = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", String(payload.agentId)),
  ]);
  const agentDoc = agentRes.documents[0];
  if (!agentDoc || agentDoc.role !== "agent") {
    throw new Error("Invalid agent or not an agent");
  }

  const coords = parseCoordinates(payload.coordinates);

  // Upload images
  const imageIds: Record<string, string | null> = {};
  if (imageFiles) {
    for (const key of IMAGE_KEYS) {
      if (imageFiles[key]) {
        const { fileId } = await uploadToAppwriteBucket(
          imageFiles[key].buffer,
          imageFiles[key].name
        );
        imageIds[key] = fileId;
      } else {
        imageIds[key] = null;
      }
    }
  }

  // Create property record in Appwrite (without amenities)
  const record = {
    ...payload,
    ...coords,
    agentId: String(payload.agentId),
    rooms: payload.rooms ? Number(payload.rooms) : 0,
    published: false,
    approvedBy: null,
    approvedAt: null,
    ...imageIds,
  };

  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    record
  );

  // Store amenities in Supabase
  const amenitiesArray = Array.isArray(payload.amenities)
    ? payload.amenities
    : [];
  await supabase.from("property_amenities").insert({
    property_id: doc.$id,
    amenities: amenitiesArray,
  });

  return formatProperty({ ...doc, amenities: amenitiesArray });
}

/** Update a property (owner or admin) */
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

  const imageIds: Record<string, string> = {};
  if (imageFiles) {
    for (const key of IMAGE_KEYS) {
      if (imageFiles[key]) {
        if (existing[key]) {
          await storage.deleteFile(
            process.env.APPWRITE_BUCKET_ID!,
            existing[key]
          );
        }
        const { fileId } = await uploadToAppwriteBucket(
          imageFiles[key].buffer,
          imageFiles[key].name
        );
        imageIds[key] = fileId;
      }
    }
  }

  const payload = {
    ...updates,
    ...coords,
    ...imageIds,
  };

  const doc = await databases.updateDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id,
    payload
  );

  // Update amenities in Supabase if provided
  if (updates.amenities) {
    const amenitiesArray = Array.isArray(updates.amenities)
      ? updates.amenities
      : [];
    await supabase
      .from("property_amenities")
      .upsert({ property_id: id, amenities: amenitiesArray });
  } else {
    // fetch existing amenities
    const { data: amenitiesRes } = await supabase
      .from("property_amenities")
      .select("amenities")
      .eq("property_id", id)
      .single();
    updates.amenities = amenitiesRes?.amenities || [];
  }

  return formatProperty({ ...doc, amenities: updates.amenities });
}

/** Delete a property (owner or admin) */
export async function deleteProperty(
  id: string,
  accountId: string,
  isAdmin = false
) {
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );

  if (!isAdmin && existing.agentId !== accountId) {
    throw new Error("Not authorized");
  }

  // Delete images from Appwrite
  for (const key of IMAGE_KEYS) {
    if (existing[key]) {
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, existing[key]);
    }
  }

  // Delete property document
  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);

  // Delete amenities from Supabase
  await supabase.from("property_amenities").delete().eq("property_id", id);
}
