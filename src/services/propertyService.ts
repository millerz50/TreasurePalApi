// server/services/propertyService.ts
import { Client, Databases, ID } from "node-appwrite";
import { uploadToAppwriteBucket } from "../lib/uploadToAppwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const PROPERTIES_COLLECTION =
  process.env.APPWRITE_PROPERTIES_COLLECTION_ID || "properties";
const USERS_COLLECTION = process.env.APPWRITE_USERS_COLLECTION_ID || "users";

function toCsv(value: any): string {
  if (!value) return "";
  if (Array.isArray(value))
    return value
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
  return String(value).trim();
}
function fromCsv(value: any): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function parseCoordinates(value: any): {
  locationLat?: number;
  locationLng?: number;
} {
  if (!value) return {};
  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng))
      return { locationLat: lat, locationLng: lng };
    return {};
  }
  if (typeof value === "string" && value.includes(",")) {
    const [latS, lngS] = value.split(",");
    const lat = Number(latS);
    const lng = Number(lngS);
    if (!Number.isNaN(lat) && !Number.isNaN(lng))
      return { locationLat: lat, locationLng: lng };
  }
  return {};
}
function formatProperty(doc: any) {
  return {
    $id: doc.$id,
    title: doc.title,
    price: doc.price,
    location: doc.location,
    address: doc.address,
    rooms: typeof doc.rooms === "number" ? doc.rooms : Number(doc.rooms || 0),
    description: doc.description || "",
    type: doc.type || "",
    status: doc.status || "pending",
    country: doc.country || "",
    amenities: fromCsv(doc.amenities),
    locationLat: doc.locationLat !== undefined ? Number(doc.locationLat) : null,
    locationLng: doc.locationLng !== undefined ? Number(doc.locationLng) : null,
    agentId: doc.agentId,
    images: Array.isArray(doc.images)
      ? doc.images
      : doc.images
      ? fromCsv(doc.images)
      : [],
    imageUrl: doc.imageUrl || null,
    published: !!doc.published,
    approvedBy: doc.approvedBy || null,
    approvedAt: doc.approvedAt || null,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

export async function listProperties(limit = 100) {
  const res = await databases.listDocuments(
    DB_ID,
    PROPERTIES_COLLECTION,
    [],
    String(limit)
  );
  return res.documents.map(formatProperty);
}

export async function getPropertyById(id: string) {
  const doc = await databases.getDocument(DB_ID, PROPERTIES_COLLECTION, id);
  return formatProperty(doc);
}

export async function createProperty(
  payload: any,
  imageBuffer?: Buffer,
  imageName?: string
) {
  // validate agent exists and is agent role
  const agentId = String(payload.agentId);
  const agentDoc = await databases
    .getDocument(DB_ID, USERS_COLLECTION, agentId)
    .catch(() => null);
  if (!agentDoc || agentDoc.role !== "agent")
    throw new Error("Invalid agentId or user is not an agent");

  let imageUrl: string | null = null;
  if (imageBuffer && imageName) {
    imageUrl = await uploadToAppwriteBucket(imageBuffer, imageName);
  }

  const coords = parseCoordinates(payload.coordinates);
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
    agentId,
    images: payload.images
      ? Array.isArray(payload.images)
        ? payload.images.join(",")
        : String(payload.images)
      : undefined,
    imageUrl,
    published: false,
    approvedBy: null,
    approvedAt: null,
  };

  const doc = await databases.createDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    ID.unique(),
    record
  );
  return formatProperty(doc);
}

export async function updateProperty(
  id: string,
  updates: any,
  imageBuffer?: Buffer,
  imageName?: string
) {
  // optional: verify ownership/admin outside or inside this function as required
  let imageUrl: string | null = null;
  if (imageBuffer && imageName)
    imageUrl = await uploadToAppwriteBucket(imageBuffer, imageName);

  const coords = parseCoordinates(updates.coordinates);
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
    ...(updates.agentId !== undefined && { agentId: String(updates.agentId) }),
    ...(updates.images !== undefined && {
      images: Array.isArray(updates.images)
        ? updates.images.join(",")
        : String(updates.images),
    }),
    ...(imageUrl && { imageUrl }),
  };

  const doc = await databases.updateDocument(
    DB_ID,
    PROPERTIES_COLLECTION,
    id,
    payload
  );
  return formatProperty(doc);
}

export async function deleteProperty(id: string) {
  await databases.deleteDocument(DB_ID, PROPERTIES_COLLECTION, id);
  return;
}
