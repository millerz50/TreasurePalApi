import { ID, Query } from "node-appwrite";
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

/** -------------------- CRUD -------------------- */

/** List properties (public) */
export async function listProperties(limit = 100) {
  const res = await databases.listDocuments(
    DB_ID,
    PROPERTIES_COLLECTION,
    [],
    String(limit)
  );
  return res.documents.map(formatProperty);
}

/** Get a property by ID (public) */
export async function getPropertyById(id: string) {
  const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);
  return formatProperty(doc);
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

  const record = {
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

  // ✅ NO PERMISSIONS HERE
  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    record
  );

  return formatProperty(doc);
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

  return formatProperty(doc);
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

  for (const key of IMAGE_KEYS) {
    if (existing[key]) {
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, existing[key]);
    }
  }

  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
}
