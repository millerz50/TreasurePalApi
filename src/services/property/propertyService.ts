// server/services/propertyService.ts
import { Client, Databases, ID } from "node-appwrite";
import { formatProperty } from "./propertyFormatter";
import { deletePropertyImages, uploadPropertyImages } from "./propertyImages";
import { buildPropertyPermissions } from "./propertyPermissions";
import { parseCoordinates, toCsv } from "./propertyUtils";
import { validateAgent } from "./propertyValidation";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!); // Server API key, bypasses session restrictions

const databases = new Databases(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const PROPERTIES_COLLECTION = "properties";

/**
 * List properties
 */
export async function listProperties(limit = 100) {
  const res = await databases.listDocuments(
    DB_ID,
    PROPERTIES_COLLECTION,
    [],
    String(limit)
  );
  return res.documents.map(formatProperty);
}

/**
 * Get a single property by ID
 */
export async function getPropertyById(id: string) {
  const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);
  if (!doc) throw new Error(`Property with ID ${id} not found`);
  return formatProperty(doc);
}

/**
 * Create property (agent)
 * @param payload - property data
 * @param accountId - Appwrite user.$id from auth middleware
 */
export async function createProperty(
  payload: any,
  accountId: string,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  // ✅ Ensure agent is valid in your users collection
  await validateAgent(accountId);

  const coords = parseCoordinates(payload.coordinates);
  const imageIds = await uploadPropertyImages(imageFiles);

  const record: any = {
    title: payload.title ?? "",
    price: payload.price ?? 0,
    location: payload.location ?? "",
    address: payload.address ?? "",
    rooms: payload.rooms ? Number(payload.rooms) : 0,
    description: payload.description ?? "",
    type: payload.type ?? "",
    status: payload.status ?? "pending",
    country: payload.country ?? "",
    amenities: toCsv(payload.amenities),
    ...coords,
    agentId: accountId, // store Appwrite accountId
    published: false,
    approvedBy: null,
    approvedAt: null,
    ...imageIds,
  };

  // 🔑 Set permissions so agent and admins can manage the document
  const permissions = buildPropertyPermissions(accountId);

  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    record,
    permissions
  );

  return formatProperty(doc);
}

/**
 * Update property
 */
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
  if (!existing) throw new Error("Property not found");

  // ✅ Only admins or the property owner can update
  if (!isAdmin && existing.agentId !== accountId) {
    throw new Error("You are not allowed to update this property");
  }

  const coords = parseCoordinates(updates.coordinates);
  const imageIds = await uploadPropertyImages(imageFiles);

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

/**
 * Delete property
 */
export async function deleteProperty(
  id: string,
  accountId: string,
  isAdmin = false
) {
  const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);
  if (!doc) throw new Error("Property not found");

  // ✅ Only admins or the property owner can delete
  if (!isAdmin && doc.agentId !== accountId) {
    throw new Error("You are not allowed to delete this property");
  }

  await deletePropertyImages(doc);
  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
}
