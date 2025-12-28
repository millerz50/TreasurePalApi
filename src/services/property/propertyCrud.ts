// server/services/propertyService.ts
import { Databases, ID, Permission, Query, Role } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";
import {
  DB_ID,
  PROPERTIES_COLLECTION,
  USERS_COLLECTION,
  storage,
} from "./client";
import { formatProperty } from "./formatters";
import { IMAGE_KEYS, parseCoordinates, toCsv } from "./utils";

/** ---------------- Helper: build permissions ---------------- */
export function buildPropertyPermissions(agentId: string) {
  return [
    Permission.read(Role.user(agentId)),
    Permission.update(Role.user(agentId)),
    Permission.delete(Role.user(agentId)),
    Permission.read(Role.any()),
    Permission.update(Role.team("admins")),
    Permission.delete(Role.team("admins")),
  ];
}

const databases = new Databases(storage.client);

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
  // Validate agent
  const agentRes = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", String(payload.agentId)),
  ]);
  const agentDoc = agentRes.total > 0 ? agentRes.documents[0] : null;
  if (!agentDoc || agentDoc.role !== "agent")
    throw new Error("Invalid agentId or user is not an agent");

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

  const record: any = {
    title: payload.title,
    price: payload.price,
    location: payload.location,
    address: payload.address,
    rooms: payload.rooms ? Number(payload.rooms) : 0,
    description: payload.description || "",
    type: payload.type || "",
    status: payload.status || "pending",
    country: payload.country || "",
    amenities: toCsv(payload.amenities),
    ...coords,
    agentId: String(payload.agentId),
    published: false,
    approvedBy: null,
    approvedAt: null,
    depositAvailable: !!payload.depositAvailable,
    depositOption: payload.depositOption || "none",
    depositPercentage: payload.depositPercentage || null,
    website: payload.website || "",
    flyers: payload.flyers || "",
    hireDesigner: !!payload.hireDesigner,
    designerId: payload.designerId || null,
    subscriptionPlan: payload.subscriptionPlan || "free",
    whatsappGroup: payload.whatsappGroup || "",
    ads: payload.ads || "",
    ...imageIds,
  };

  const permissions = buildPropertyPermissions(payload.agentId);

  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    record,
    permissions
  );
  return formatProperty(doc);
}

/** Update a property (owner or admin) */
export async function updateProperty(
  id: string,
  updates: any,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>,
  isAdmin = false
) {
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );
  if (!existing) throw new Error("Property not found");

  const coords = parseCoordinates(updates.coordinates);

  // Upload new images and delete old ones if replaced
  const imageIds: Record<string, string | undefined> = {};
  if (imageFiles) {
    for (const key of IMAGE_KEYS) {
      if (imageFiles[key]) {
        if (existing[key])
          await storage.deleteFile(
            process.env.APPWRITE_BUCKET_ID!,
            existing[key]
          );
        const { fileId } = await uploadToAppwriteBucket(
          imageFiles[key].buffer,
          imageFiles[key].name
        );
        imageIds[key] = fileId;
      }
    }
  }

  const payload: any = {
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
    ...(updates.agentId !== undefined &&
      isAdmin && { agentId: String(updates.agentId) }),
    ...(updates.depositAvailable !== undefined && {
      depositAvailable: !!updates.depositAvailable,
    }),
    ...(updates.depositOption !== undefined && {
      depositOption: updates.depositOption,
    }),
    ...(updates.depositPercentage !== undefined && {
      depositPercentage: updates.depositPercentage,
    }),
    ...(updates.website !== undefined && { website: updates.website }),
    ...(updates.flyers !== undefined && { flyers: updates.flyers }),
    ...(updates.hireDesigner !== undefined && {
      hireDesigner: !!updates.hireDesigner,
    }),
    ...(updates.designerId !== undefined && { designerId: updates.designerId }),
    ...(updates.subscriptionPlan !== undefined && {
      subscriptionPlan: updates.subscriptionPlan,
    }),
    ...(updates.whatsappGroup !== undefined && {
      whatsappGroup: updates.whatsappGroup,
    }),
    ...(updates.ads !== undefined && { ads: updates.ads }),
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
export async function deleteProperty(id: string) {
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );
  if (!existing) throw new Error("Property not found");

  for (const key of IMAGE_KEYS) {
    if (existing[key])
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, existing[key]);
  }

  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
}
