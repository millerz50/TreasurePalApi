import { ID, Permission, Query, Role } from "node-appwrite";
import { uploadToAppwriteBucket } from "../../lib/uploadToAppwrite";
import {
  DB_ID,
  PROPERTIES_TABLE,
  storage,
  tablesDB,
  USERS_TABLE,
} from "./client";
import { formatProperty } from "./formatters";
import { IMAGE_KEYS, parseCoordinates, toCsv } from "./utils";

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
  // validate agent
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

    // deposit
    depositAvailable: !!payload.depositAvailable,
    depositOption: payload.depositOption || "none",
    depositPercentage: payload.depositPercentage || null,

    // marketing
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
    Permission.read(Role.any()),
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

    // deposit
    ...(updates.depositAvailable !== undefined && {
      depositAvailable: !!updates.depositAvailable,
    }),
    ...(updates.depositOption !== undefined && {
      depositOption: updates.depositOption,
    }),
    ...(updates.depositPercentage !== undefined && {
      depositPercentage: updates.depositPercentage,
    }),

    // marketing
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
