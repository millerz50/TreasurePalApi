import { ID, Permission, Query, Role } from "node-appwrite";
import { uploadToAppwriteBucket } from "../lib/uploadToAppwrite";
import {
  DB_ID,
  PROPERTIES_COLLECTION,
  USERS_COLLECTION,
  databases,
  storage,
} from "../services/property/client";
import { formatProperty } from "../services/property/propertyFormatter";
import {
  IMAGE_KEYS,
  parseCoordinates,
  toCsv,
} from "../services/property/utils";

/** ---------------- Helper: build permissions ---------------- */
export function buildPropertyPermissions(agentId: string) {
  return [
    // Owner (agent)
    Permission.read(Role.user(agentId)),
    Permission.update(Role.user(agentId)),
    Permission.delete(Role.user(agentId)),

    // Public read
    Permission.read(Role.any()),
  ];
}

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

/** Get property by ID (public) */
export async function getPropertyById(id: string) {
  const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);
  return formatProperty(doc);
}

/** Create property (agent) */
export async function createProperty(
  payload: any,
  agentId: string,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  // Validate agent
  const agentRes = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", agentId),
  ]);

  const agentDoc = agentRes.documents[0];
  if (!agentDoc || agentDoc.role !== "agent") {
    throw new Error("Invalid agent");
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
      }
    }
  }

  const record = {
    ...payload,
    ...coords,
    agentId,
    rooms: payload.rooms ? Number(payload.rooms) : 0,
    amenities: toCsv(payload.amenities),
    published: false,
    approvedBy: null,
    approvedAt: null,
    ...imageIds,
  };

  const permissions = buildPropertyPermissions(agentId);

  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    record,
    permissions
  );

  return formatProperty(doc);
}

/** Update property (owner or admin) */
export async function updateProperty(
  id: string,
  updates: any,
  userId: string,
  isAdmin = false,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );

  if (!isAdmin && existing.agentId !== userId) {
    throw new Error("Forbidden");
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

/** Delete property (owner or admin) */
export async function deleteProperty(id: string) {
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );

  for (const key of IMAGE_KEYS) {
    if (existing[key]) {
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, existing[key]);
    }
  }

  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
}
