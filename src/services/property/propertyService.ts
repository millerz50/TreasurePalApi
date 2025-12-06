// server/services/propertyService.ts
import {
  Client,
  ID,
  Permission,
  Query,
  Role,
  Storage,
  TablesDB,
} from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const tablesDB = new TablesDB(client);
const storage = new Storage(client);

// ✅ Database and collection IDs
const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const PROPERTIES_TABLE = "properties";
const USERS_TABLE = process.env.APPWRITE_USERTABLE_ID!;

const IMAGE_KEYS = [
  "frontElevation",
  "southView",
  "westView",
  "eastView",
  "floorPlan",
] as const;

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

function getPreviewUrl(fileId: string | null): string | null {
  if (!fileId) return null;
  const endpoint = process.env.APPWRITE_ENDPOINT!.replace(/\/$/, "");
  const bucketId = process.env.APPWRITE_BUCKET_ID!;
  const projectId = process.env.APPWRITE_PROJECT_ID!;
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${projectId}`;
}

function formatProperty(row: any) {
  const base = {
    $id: row.$id,
    title: row.title,
    price: row.price,
    location: row.location,
    address: row.address,
    rooms: typeof row.rooms === "number" ? row.rooms : Number(row.rooms || 0),
    description: row.description || "",
    type: row.type || "",
    status: row.status || "pending",
    country: row.country || "",
    amenities: fromCsv(row.amenities),
    locationLat: row.locationLat !== undefined ? Number(row.locationLat) : null,
    locationLng: row.locationLng !== undefined ? Number(row.locationLng) : null,
    agentId: row.agentId,
    published: !!row.published,
    approvedBy: row.approvedBy || null,
    approvedAt: row.approvedAt || null,

    // ✅ deposit fields
    depositAvailable: !!row.depositAvailable,
    depositOption: row.depositOption || "none",
    depositPercentage: row.depositPercentage || null,

    // ✅ marketing fields
    website: row.website || "",
    flyers: row.flyers || "",
    hireDesigner: !!row.hireDesigner,
    designerId: row.designerId || null,
    subscriptionPlan: row.subscriptionPlan || "free",
    whatsappGroup: row.whatsappGroup || "",
    ads: row.ads || "",

    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };

  const images: Record<
    string,
    { fileId: string | null; previewUrl: string | null }
  > = {};
  IMAGE_KEYS.forEach((key) => {
    const fileId = row[key] || null;
    images[key] = { fileId, previewUrl: getPreviewUrl(fileId) };
  });

  return { ...base, images };
}

// -------------------- CRUD --------------------

export async function listProperties(limit = 100) {
  const res = await tablesDB.listRows(
    DB_ID,
    PROPERTIES_TABLE,
    [],
    String(limit)
  );
  return res.rows.map(formatProperty);
}

export async function getPropertyById(id: string) {
  const row = await tablesDB.getRow(DB_ID, PROPERTIES_TABLE, id);
  return formatProperty(row);
}

export async function createProperty(
  payload: any,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  // ✅ Validate agent by accountid
  const agentRes = await tablesDB.listRows(DB_ID, USERS_TABLE, [
    Query.equal("accountid", String(payload.agentId)),
  ]);
  const agentDoc = agentRes.total > 0 ? agentRes.rows[0] : null;
  if (!agentDoc || agentDoc.role !== "agent")
    throw new Error("Invalid agentId or user is not an agent");

  const coords = parseCoordinates(payload.coordinates);

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

    // ✅ deposit fields
    depositAvailable: !!payload.depositAvailable,
    depositOption: payload.depositOption || "none",
    depositPercentage: payload.depositPercentage || null,

    // ✅ marketing fields
    website: payload.website || "",
    flyers: payload.flyers || "",
    hireDesigner: !!payload.hireDesigner,
    designerId: payload.designerId || null,
    subscriptionPlan: payload.subscriptionPlan || "free",
    whatsappGroup: payload.whatsappGroup || "",
    ads: payload.ads || "",

    ...imageIds,
  };

  const permissions = [
    Permission.read(Role.user(payload.agentId)),
    Permission.update(Role.user(payload.agentId)),
    Permission.delete(Role.user(payload.agentId)),
    Permission.read(Role.any()), // optional public read
    Permission.update(Role.team("admins")),
    Permission.delete(Role.team("admins")),
  ];

  const row = await tablesDB.createRow(
    DB_ID,
    PROPERTIES_TABLE,
    ID.unique(),
    record,
    permissions
  );
  return formatProperty(row);
}
export async function updateProperty(
  id: string,
  updates: any,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
  const coords = parseCoordinates(updates.coordinates);

  const imageIds: Record<string, string | undefined> = {};
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

    // ✅ deposit fields
    ...(updates.depositAvailable !== undefined && {
      depositAvailable: !!updates.depositAvailable,
    }),
    ...(updates.depositOption !== undefined && {
      depositOption: updates.depositOption,
    }),
    ...(updates.depositPercentage !== undefined && {
      depositPercentage: updates.depositPercentage,
    }),

    // ✅ marketing fields
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

  const row = await tablesDB.updateRow(DB_ID, PROPERTIES_TABLE, id, payload);
  return formatProperty(row);
}

export async function deleteProperty(id: string) {
  const row = await tablesDB.getRow(DB_ID, PROPERTIES_TABLE, id);
  for (const key of IMAGE_KEYS) {
    if (row[key]) {
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, row[key]);
    }
  }
  await tablesDB.deleteRow(DB_ID, PROPERTIES_TABLE, id);
}
