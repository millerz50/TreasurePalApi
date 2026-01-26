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

type ImageUpload = {
  buffer: Buffer;
  name: string;
};

async function uploadPropertyImages(
  imageFiles?: Record<string, ImageUpload>,
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

function formatProperty(doc: Record<string, any>) {
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
        amenities: data?.amenities ?? [],
      });
    }),
  );
}

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
        amenities: data?.amenities ?? [],
      });
    }),
  );
}

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
    amenities: data?.amenities ?? [],
  });
}

/* ------------------------------- CREATE --------------------------------- */

export async function createProperty(
  payload: Record<string, any>,
  accountId: string,
  imageFiles?: Record<string, ImageUpload>,
) {
  await validateAgent(accountId);

  const coords = parseCoordinates(payload.coordinates);
  const images = await uploadPropertyImages(imageFiles);
  const propertyId = ID.unique();

  // Ensure status is either "forRent" or "forSale"
  const propertyStatus =
    payload.property_status === "forSale" ? "forSale" : "forRent";

  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    propertyId,
    {
      title: payload.title ?? "",
      price: Number(payload.price ?? 0),
      location: payload.location ?? "",
      address: payload.address ?? "",
      rooms: Number(payload.rooms ?? 0),
      description: payload.description ?? "",
      type: payload.type ?? "",
      subType: payload.subType ?? "", // ✅ include subType
      status: propertyStatus,
      country: payload.country ?? "",
      agentId: accountId,
      published: false,
      approvedBy: null,
      approvedAt: null,
      url: payload.url ?? `/properties/${propertyId}`,
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
  updates: Record<string, any>,
  accountId: string,
  isAdmin = false,
  imageFiles?: Record<string, ImageUpload>,
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

  // Ensure status is valid if being updated
  const statusUpdate =
    updates.status === "forSale" || updates.status === "forRent"
      ? updates.status
      : undefined;

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
    ...(updates.subType !== undefined && { subType: updates.subType }), // ✅ update subType
    ...(statusUpdate !== undefined && { status: statusUpdate }),
    ...(updates.country !== undefined && { country: updates.country }),
    ...coords,
    ...images,
  });

  let amenities: string[] = [];

  if (updates.amenities !== undefined) {
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
    amenities = data?.amenities ?? [];
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
