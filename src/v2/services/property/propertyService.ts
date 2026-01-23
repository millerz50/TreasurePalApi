// server/services/property/propertyService.ts
import { ID, Query } from "node-appwrite";
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

async function uploadPropertyImages(
  imageFiles?: Record<string, { buffer: Buffer; name: string }>,
): Promise<Record<string, string | null>> {
  const images: Record<string, string | null> = {};

  for (const key of IMAGE_KEYS) {
    if (!imageFiles?.[key]) {
      images[key] = null;
      continue;
    }

    try {
      const { buffer, name } = imageFiles[key];
      const { fileId } = await uploadToAppwriteBucket(buffer, name);
      images[key] = fileId;
    } catch (err) {
      console.error(`❌ Failed to upload ${key}:`, getErrorMessage(err));
      images[key] = null;
    }
  }

  return images;
}

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

/* ------------------------------- READ ----------------------------------- */

/** List ALL properties (optionally filtered by type) */
export async function listProperties(type?: string, limit = 100) {
  const queries: any[] = [];

  if (type) {
    queries.push(Query.equal("type", type));
  }

  const res = await databases.listDocuments(
    DB_ID,
    PROPERTIES_COLLECTION,
    queries,
    String(limit),
  );

  return Promise.all(
    res.documents.map(async (doc) => {
      const { data } = await supabase
        .from("property_amenities")
        .select("amenities")
        .eq("property_id", doc.$id)
        .single();

      return formatProperty({
        ...doc,
        amenities: data?.amenities || [],
      });
    }),
  );
}

/** ✅ List properties by STATUS (pending, approved, rejected) */
export async function listByStatus(status: string, limit = 100) {
  const res = await databases.listDocuments(
    DB_ID,
    PROPERTIES_COLLECTION,
    [Query.equal("status", status)],
    String(limit),
  );

  return Promise.all(
    res.documents.map(async (doc) => {
      const { data } = await supabase
        .from("property_amenities")
        .select("amenities")
        .eq("property_id", doc.$id)
        .single();

      return formatProperty({
        ...doc,
        amenities: data?.amenities || [],
      });
    }),
  );
}

/** Get property by ID */
export async function getPropertyById(id: string) {
  const property = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id,
  );

  const { data } = await supabase
    .from("property_amenities")
    .select("amenities")
    .eq("property_id", id)
    .single();

  return formatProperty({
    ...property,
    amenities: data?.amenities || [],
  });
}

/* ------------------------------- CREATE --------------------------------- */

export async function createProperty(
  payload: any,
  accountId: string,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>,
) {
  await validateAgent(accountId);

  const coords = parseCoordinates(payload.coordinates);
  const images = await uploadPropertyImages(imageFiles);

  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    {
      title: payload.title ?? "",
      price: Number(payload.price ?? 0),
      location: payload.location ?? "",
      address: payload.address ?? "",
      rooms: Number(payload.rooms ?? 0),
      description: payload.description ?? "",
      type: payload.type ?? "",
      status: "pending",
      country: payload.country ?? "",
      agentId: accountId,
      published: false,
      approvedBy: null,
      approvedAt: null,
      url: payload.url ?? `/properties/${ID.unique()}`,
      ...coords,
      ...images,
    },
    buildPropertyPermissions(accountId),
  );

  const amenities = Array.isArray(payload.amenities) ? payload.amenities : [];

  await supabase.from("property_amenities").insert({
    property_id: doc.$id,
    amenities,
  });

  return formatProperty({ ...doc, amenities });
}

/* ------------------------------- UPDATE --------------------------------- */

export async function updateProperty(
  id: string,
  updates: any,
  accountId: string,
  isAdmin = false,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>,
) {
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id,
  );

  if (!isAdmin && existing.agentId !== accountId) {
    throw new Error("Not authorized");
  }

  const coords = parseCoordinates(updates.coordinates);
  const images = imageFiles ? await uploadPropertyImages(imageFiles) : {};

  const doc = await databases.updateDocument(DB_ID, PROPERTIES_COLLECTION, id, {
    ...(updates.title && { title: updates.title }),
    ...(updates.price && { price: Number(updates.price) }),
    ...(updates.location && { location: updates.location }),
    ...(updates.address && { address: updates.address }),
    ...(updates.rooms && { rooms: Number(updates.rooms) }),
    ...(updates.description && { description: updates.description }),
    ...(updates.type && { type: updates.type }),
    ...(updates.status && { status: updates.status }),
    ...(updates.country && { country: updates.country }),
    ...coords,
    ...images,
  });

  let amenities: string[] = [];

  if (updates.amenities) {
    amenities = Array.isArray(updates.amenities) ? updates.amenities : [];
    await supabase.from("property_amenities").upsert({
      property_id: id,
      amenities,
    });
  } else {
    const { data } = await supabase
      .from("property_amenities")
      .select("amenities")
      .eq("property_id", id)
      .single();
    amenities = data?.amenities || [];
  }

  return formatProperty({ ...doc, amenities });
}

/* ------------------------------- DELETE --------------------------------- */

export async function deleteProperty(
  id: string,
  accountId: string,
  isAdmin = false,
) {
  const property = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id,
  );

  if (!isAdmin && property.agentId !== accountId) {
    throw new Error("Not authorized");
  }

  for (const key of IMAGE_KEYS) {
    const fileId = property[key];
    if (fileId) {
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, fileId);
    }
  }

  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
  await supabase.from("property_amenities").delete().eq("property_id", id);
}
