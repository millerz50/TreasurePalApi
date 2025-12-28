// server/services/propertyService.ts
import { Client, ID, Query, TablesDB } from "node-appwrite";
import { formatProperty } from "./propertyFormatter";
import { deletePropertyImages, uploadPropertyImages } from "./propertyImages";
import { buildPropertyPermissions } from "./propertyPermissions";
import { parseCoordinates, toCsv } from "./propertyUtils";
import { validateAgent } from "./propertyValidation";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const tablesDB = new TablesDB(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const PROPERTIES_TABLE = "properties";

/**
 * List properties
 */
export async function listProperties(limit = 100) {
  const res = await tablesDB.listRows(DB_ID, PROPERTIES_TABLE, [
    Query.limit(limit),
  ]);
  return res.rows.map(formatProperty);
}

/**
 * Get a single property by ID
 */
export async function getPropertyById(id: string) {
  const row = await tablesDB.getRow(DB_ID, PROPERTIES_TABLE, id);
  return formatProperty(row);
}

/**
 * Create property (agent)
 * @param payload - property data
 * @param imageFiles - optional image uploads
 * @param userId - authenticated agent ID
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

  const record = {
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

    // Always use authenticated agentId
    agentId: userId,

    published: false,
    approvedBy: null,
    approvedAt: null,

    ...imageIds,
  };

  const permissions = buildPropertyPermissions(userId);

  const row = await tablesDB.createRow(
    DB_ID,
    PROPERTIES_TABLE,
    ID.unique(),
    record,
    permissions
  );

  return formatProperty(row);
}

/**
 * Update property
 * @param id - property ID
 * @param updates - fields to update
 * @param userId - authenticated user ID
 * @param isAdmin - whether user is admin
 * @param imageFiles - optional images
 */
export async function updateProperty(
  id: string,
  updates: any,
  userId: string,
  isAdmin = false,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  const existing = await tablesDB.getRow(DB_ID, PROPERTIES_TABLE, id);
  if (!existing) throw new Error("Property not found");

  // ✅ Normal agents cannot change agentId
  if (!isAdmin) delete updates.agentId;

  const coords = parseCoordinates(updates.coordinates);
  const imageIds = await uploadPropertyImages(imageFiles);

  const payload = {
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

  const row = await tablesDB.updateRow(DB_ID, PROPERTIES_TABLE, id, payload);
  return formatProperty(row);
}

/**
 * Delete property
 * @param id - property ID
 */
export async function deleteProperty(id: string) {
  const row = await tablesDB.getRow(DB_ID, PROPERTIES_TABLE, id);
  if (!row) throw new Error("Property not found");

  await deletePropertyImages(row);
  await tablesDB.deleteRow(DB_ID, PROPERTIES_TABLE, id);
}
