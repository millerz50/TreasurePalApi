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
  .setKey(process.env.APPWRITE_API_KEY!);

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
  return formatProperty(doc);
}

/**
 * Create property (agent)
 */
export async function createProperty(
  payload: any,
  userId: string,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  // ✅ Ensure agent is valid
  await validateAgent(userId);

  const coords = parseCoordinates(payload.coordinates);
  const imageIds = await uploadPropertyImages(imageFiles);

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
    agentId: userId,
    published: false,
    approvedBy: null,
    approvedAt: null,
    ...imageIds,
  };

  const permissions = buildPropertyPermissions(userId);

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
  userId: string,
  isAdmin = false,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  const existing = await databases.getDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id
  );
  if (!existing) throw new Error("Property not found");

  if (!isAdmin) delete updates.agentId;

  const coords = parseCoordinates(updates.coordinates);
  const imageIds = await uploadPropertyImages(imageFiles);

  const payload: any = {
    ...(updates.title && { title: updates.title }),
    ...(updates.price && { price: updates.price }),
    ...(updates.location && { location: updates.location }),
    ...(updates.address && { address: updates.address }),
    ...(updates.rooms && { rooms: Number(updates.rooms) }),
    ...(updates.description && { description: updates.description }),
    ...(updates.type && { type: updates.type }),
    ...(updates.status && { status: updates.status }),
    ...(updates.country && { country: updates.country }),
    ...(updates.amenities && { amenities: toCsv(updates.amenities) }),
    ...coords,
    ...(updates.agentId && { agentId: String(updates.agentId) }),
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
export async function deleteProperty(id: string) {
  const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);
  if (!doc) throw new Error("Property not found");

  await deletePropertyImages(doc);
  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
}
