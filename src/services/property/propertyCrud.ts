import { ID, Permission, Query, Role } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";
import {
  DB_ID,
  PROPERTIES_COLLECTION,
  USERS_COLLECTION,
  databases,
  storage,
} from "./client";
import { formatProperty } from "./formatters";
import { IMAGE_KEYS, parseCoordinates, toCsv } from "./utils";

/** ---------------- Helper: build permissions ---------------- */
export function buildPropertyPermissions(agentId: string) {
  console.log("🔐 Building permissions for agent:", agentId);
  return [
    Permission.read(Role.user(agentId)),
    Permission.update(Role.user(agentId)),
    Permission.delete(Role.user(agentId)),
    Permission.read(Role.any()),
    Permission.update(Role.team("admins")),
    Permission.delete(Role.team("admins")),
  ];
}

/** -------------------- CRUD -------------------- */

/** List properties (public) */
export async function listProperties(limit = 100) {
  console.log("📋 Listing properties, limit:", limit);
  const res = await databases.listDocuments(
    DB_ID,
    PROPERTIES_COLLECTION,
    [],
    String(limit)
  );
  console.log("✅ Properties fetched:", res.total);
  return res.documents.map(formatProperty);
}

/** Get a property by ID (public) */
export async function getPropertyById(id: string) {
  console.log("🔎 Fetching property by ID:", id);
  const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);
  console.log("✅ Property fetched:", doc.$id);
  return formatProperty(doc);
}

/** Create a property (agent) */
export async function createProperty(
  payload: any,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  console.log("➕ Creating property with payload:", payload);

  // Validate agent
  console.log("🔎 Validating agent:", payload.agentId);
  const agentRes = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", String(payload.agentId)),
  ]);
  const agentDoc = agentRes.total > 0 ? agentRes.documents[0] : null;
  if (!agentDoc || agentDoc.role !== "agent") {
    console.error("❌ Agent validation failed:", payload.agentId);
    throw new Error("Invalid agentId or user is not an agent");
  }
  console.log("✅ Agent validated:", agentDoc.$id);

  const coords = parseCoordinates(payload.coordinates);
  console.log("📍 Parsed coordinates:", coords);

  // Upload images
  const imageIds: Record<string, string | null> = {};
  if (imageFiles) {
    console.log("🖼 Uploading images...");
    for (const key of IMAGE_KEYS) {
      if (imageFiles[key]) {
        const { fileId } = await uploadToAppwriteBucket(
          imageFiles[key].buffer,
          imageFiles[key].name
        );
        imageIds[key] = fileId;
        console.log(`✅ Uploaded image for ${key}:`, fileId);
      } else {
        imageIds[key] = null;
      }
    }
  }

  const record: any = {
    ...payload,
    ...coords,
    agentId: String(payload.agentId),
    rooms: payload.rooms ? Number(payload.rooms) : 0,
    amenities: toCsv(payload.amenities),
    published: false,
    approvedBy: null,
    approvedAt: null,
    ...imageIds,
  };

  const permissions = buildPropertyPermissions(payload.agentId);

  console.log("📤 Creating document in Appwrite...");
  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    record,
    permissions
  );
  console.log("✅ Property created:", doc.$id);

  return formatProperty(doc);
}

/** Update a property (owner or admin) */
export async function updateProperty(
  id: string,
  updates: any,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>,
  isAdmin = false
) {
  console.log("✏️ Updating property:", id, "Updates:", updates);

  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );
  if (!existing) {
    console.error("❌ Property not found:", id);
    throw new Error("Property not found");
  }
  console.log("✅ Existing property loaded:", existing.$id);

  const coords = parseCoordinates(updates.coordinates);
  console.log("📍 Parsed coordinates:", coords);

  // Upload new images
  const imageIds: Record<string, string | undefined> = {};
  if (imageFiles) {
    console.log("🖼 Uploading new images...");
    for (const key of IMAGE_KEYS) {
      if (imageFiles[key]) {
        if (existing[key]) {
          console.log(`🗑 Deleting old image for ${key}:`, existing[key]);
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
        console.log(`✅ Uploaded new image for ${key}:`, fileId);
      }
    }
  }

  const payload: any = {
    ...updates,
    ...coords,
    ...(updates.agentId !== undefined &&
      isAdmin && { agentId: String(updates.agentId) }),
    ...imageIds,
  };

  console.log("📤 Updating document in Appwrite...");
  const doc = await databases.updateDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id,
    payload
  );
  console.log("✅ Property updated:", doc.$id);

  return formatProperty(doc);
}

/** Delete a property (owner or admin) */
export async function deleteProperty(id: string) {
  console.log("🗑 Deleting property:", id);

  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );
  if (!existing) {
    console.error("❌ Property not found:", id);
    throw new Error("Property not found");
  }
  console.log("✅ Existing property loaded:", existing.$id);

  for (const key of IMAGE_KEYS) {
    if (existing[key]) {
      console.log(`🗑 Deleting image for ${key}:`, existing[key]);
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, existing[key]);
    }
  }

  console.log("📤 Deleting document in Appwrite...");
  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
  console.log("✅ Property deleted:", id);
}
