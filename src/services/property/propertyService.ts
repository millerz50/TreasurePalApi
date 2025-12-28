// server/services/property/propertyService.ts
import { ID } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";
import { databases, DB_ID, PROPERTIES_COLLECTION, storage } from "./client";
import { formatProperty } from "./propertyFormatter";
import { buildPropertyPermissions } from "./propertyPermissions";
import { validateAgent } from "./propertyValidation";
import { IMAGE_KEYS, parseCoordinates, toCsv } from "./utils";

/**
 * Safely extract an error message from unknown error objects
 */
function getErrorMessage(err: unknown): string {
  if (!err) return String(err);
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any;
    if (anyErr && typeof anyErr.message === "string") return anyErr.message;
    return JSON.stringify(anyErr);
  } catch {
    return String(err);
  }
}

/**
 * Upload helper that returns a map of image keys -> fileId (or null)
 */
async function uploadPropertyImages(
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  const imageIds: Record<string, string | null> = {};
  if (!imageFiles) return imageIds;

  for (const key of IMAGE_KEYS) {
    if (imageFiles[key]) {
      try {
        const { fileId } = await uploadToAppwriteBucket(
          imageFiles[key].buffer,
          imageFiles[key].name
        );
        imageIds[key] = fileId;
        console.log(`🖼 [uploadPropertyImages] uploaded ${key}:`, fileId);
      } catch (err: unknown) {
        console.error(
          `❌ [uploadPropertyImages] failed for ${key}:`,
          getErrorMessage(err)
        );
        throw new Error("Image upload failed");
      }
    } else {
      imageIds[key] = null;
    }
  }
  return imageIds;
}

/** -------------------- CRUD -------------------- */

/** List properties (public) */
export async function listProperties(limit = 100) {
  console.log("📋 [listProperties] fetching, limit:", limit);
  try {
    const res = await databases.listDocuments(
      DB_ID,
      PROPERTIES_COLLECTION,
      [],
      String(limit)
    );
    console.log("✅ [listProperties] fetched:", res.total);
    return res.documents.map(formatProperty);
  } catch (err: unknown) {
    console.error("❌ [listProperties] error:", getErrorMessage(err));
    throw new Error(getErrorMessage(err) || "Failed to list properties");
  }
}

/** Get a property by ID (public) */
export async function getPropertyById(id: string) {
  console.log("🔎 [getPropertyById] id:", id);
  try {
    const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);
    if (!doc) {
      throw new Error("Property not found");
    }
    console.log("✅ [getPropertyById] found:", doc.$id);
    return formatProperty(doc);
  } catch (err: unknown) {
    console.error("❌ [getPropertyById] error:", getErrorMessage(err));
    throw new Error(getErrorMessage(err) || "Failed to fetch property");
  }
}

/** Create property (only agents) */
export async function createProperty(
  payload: any,
  accountId: string,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  console.log("➕ [createProperty] start. accountId:", accountId);
  console.log("   payload keys:", Object.keys(payload || {}).slice(0, 20));

  // Validate agent profile and roles (throws on failure)
  const agentProfile = await validateAgent(accountId);
  console.log(
    "✅ [createProperty] agent validated, profile $id:",
    agentProfile.$id
  );

  // Parse coordinates
  const coords = parseCoordinates(payload.coordinates);
  console.log("   parsed coords:", coords);

  // Upload images
  const imageIds = await uploadPropertyImages(imageFiles);

  // Build record with explicit defaults
  const record: any = {
    title: payload.title ?? "",
    price: payload.price ? Number(payload.price) : 0,
    location: payload.location ?? "",
    address: payload.address ?? "",
    rooms: payload.rooms ? Number(payload.rooms) : 0,
    description: payload.description ?? "",
    type: payload.type ?? "",
    status: payload.status ?? "pending",
    country: payload.country ?? "",
    amenities: toCsv(payload.amenities),
    ...coords,
    agentId: accountId, // store Appwrite account $id
    published: false,
    approvedBy: null,
    approvedAt: null,
    ...imageIds,
  };

  console.log("   final record preview:", {
    title: record.title,
    price: record.price,
    agentId: record.agentId,
    amenities: record.amenities,
  });

  // Build permissions using Appwrite account $id so the JWT user will match
  const permissions = buildPropertyPermissions(accountId);
  console.log("   permissions to attach:", permissions);

  try {
    const doc = await databases.createDocument(
      DB_ID,
      PROPERTIES_COLLECTION,
      ID.unique(),
      record,
      permissions
    );
    console.log("✅ [createProperty] created document id:", doc.$id);
    try {
      console.log(
        "   created doc $permissions:",
        JSON.stringify((doc as any).$permissions || [])
      );
    } catch {
      // ignore logging errors
    }
    return formatProperty(doc);
  } catch (err: unknown) {
    console.error(
      "❌ [createProperty] createDocument error:",
      getErrorMessage(err)
    );
    // attempt to inspect structured error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any;
    if (
      anyErr &&
      (anyErr.code === 401 || anyErr.type === "user_unauthorized")
    ) {
      throw new Error("Unauthorized: Appwrite rejected document creation");
    }
    throw new Error(getErrorMessage(err) || "Failed to create property");
  }
}

/** Update property (owner or admin) */
export async function updateProperty(
  id: string,
  updates: any,
  accountId: string,
  isAdmin = false,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  console.log(
    "✏️ [updateProperty] id:",
    id,
    "accountId:",
    accountId,
    "isAdmin:",
    isAdmin
  );
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );
  if (!existing) throw new Error("Property not found");

  console.log("   existing.agentId:", existing.agentId);

  if (!isAdmin && existing.agentId !== accountId) {
    console.warn("⛔ [updateProperty] caller not owner and not admin");
    throw new Error("Not authorized");
  }

  const coords = parseCoordinates(updates.coordinates);
  const imageIds: Record<string, string | undefined> = {};

  if (imageFiles) {
    for (const key of IMAGE_KEYS) {
      if (imageFiles[key]) {
        if (existing[key]) {
          try {
            // storage is imported from client and is the Appwrite Storage instance
            await storage.deleteFile(
              process.env.APPWRITE_BUCKET_ID!,
              existing[key]
            );
            console.log(
              `🗑 [updateProperty] deleted old image for ${key}:`,
              existing[key]
            );
          } catch (err: unknown) {
            console.warn(
              `⚠️ [updateProperty] failed to delete old image ${existing[key]}:`,
              getErrorMessage(err)
            );
          }
        }
        const { fileId } = await uploadToAppwriteBucket(
          imageFiles[key].buffer,
          imageFiles[key].name
        );
        imageIds[key] = fileId;
        console.log(
          `🖼 [updateProperty] uploaded new image for ${key}:`,
          fileId
        );
      }
    }
  }

  const payload = {
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.price !== undefined && { price: updates.price }),
    ...(updates.location !== undefined && { location: updates.location }),
    ...(updates.address !== undefined && { address: updates.address }),
    ...(updates.rooms !== undefined && { rooms: Number(updates.rooms) }),
    ...(updates.description !== undefined && {
      description: updates.description,
    }),
    ...(updates.type !== undefined && { type: updates.type }),
    ...(updates.status !== undefined && { status: updates.status }),
    ...(updates.country !== undefined && { country: updates.country }),
    ...(updates.amenities !== undefined && {
      amenities: toCsv(updates.amenities),
    }),
    ...coords,
    ...(updates.agentId !== undefined && { agentId: String(updates.agentId) }),
    ...imageIds,
  };

  console.log("   update payload preview:", payload);

  try {
    const doc = await databases.updateDocument(
      DB_ID,
      PROPERTIES_COLLECTION,
      id,
      payload
    );
    console.log("✅ [updateProperty] updated doc id:", doc.$id);
    return formatProperty(doc);
  } catch (err: unknown) {
    console.error(
      "❌ [updateProperty] updateDocument error:",
      getErrorMessage(err)
    );
    throw new Error(getErrorMessage(err) || "Failed to update property");
  }
}

/** Delete property */
export async function deleteProperty(id: string) {
  console.log("🗑 [deleteProperty] id:", id);
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );
  if (!existing) throw new Error("Property not found");

  for (const key of IMAGE_KEYS) {
    if (existing[key]) {
      try {
        await storage.deleteFile(
          process.env.APPWRITE_BUCKET_ID!,
          existing[key]
        );
        console.log("   deleted image:", key, existing[key]);
      } catch (err: unknown) {
        console.warn(
          "⚠️ [deleteProperty] failed to delete image:",
          key,
          getErrorMessage(err)
        );
      }
    }
  }

  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
  console.log("✅ [deleteProperty] deleted:", id);
}
