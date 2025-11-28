import { Client, ID, Query, Storage, TablesDB } from "node-appwrite";
import { uploadToAppwriteBucket } from "../lib/uploadToAppwrite";

function getPreviewUrl(fileId: string | null): string | null {
  if (!fileId) return null;

  const endpointRaw = process.env.APPWRITE_ENDPOINT!;
  const endpoint = endpointRaw.endsWith("/v1")
    ? endpointRaw.replace(/\/$/, "")
    : endpointRaw.replace(/\/$/, "") + "/v1";

  const bucketId = process.env.APPWRITE_BUCKET_ID!;
  const projectId = process.env.APPWRITE_PROJECT_ID!;

  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${projectId}`;
}

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const tablesDB = new TablesDB(client);
const storage = new Storage(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const BLOGS_TABLE = process.env.APPWRITE_BLOGS_TABLE_ID || "blogs";

const IMAGE_KEYS = ["coverImage", "thumbnail"] as const;

export interface Blog {
  $id?: string;
  title: string;
  content: string;
  authorId: string;
  authorRole: "user" | "agent" | "admin";
  status: "draft" | "published";
  createdAt?: string;
  updatedAt?: string;
  coverImage?: string | null;
  thumbnail?: string | null;
}

function formatBlog(row: any) {
  const base = {
    $id: row.$id,
    title: row.title,
    content: row.content,
    authorId: row.authorId,
    authorRole: row.authorRole,
    status: row.status || "draft",
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };

  const images: Record<
    string,
    { fileId: string | null; previewUrl: string | null }
  > = {};
  IMAGE_KEYS.forEach((key) => {
    const fileId = row[key] || null;
    images[key] = {
      fileId,
      previewUrl: getPreviewUrl(fileId),
    };
  });

  return { ...base, images };
}

// ✅ Create blog (always draft, with optional images)
export async function createBlog(
  payload: Omit<Blog, "status">,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
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
    content: payload.content,
    authorId: payload.authorId,
    authorRole: payload.authorRole,
    status: "draft",
    ...imageIds,
  };

  const row = await tablesDB.createRow(DB_ID, BLOGS_TABLE, ID.unique(), record);
  return formatBlog(row);
}

// ✅ Get all published blogs
export async function getPublishedBlogs(limit = 50) {
  const res = await tablesDB.listRows(
    DB_ID,
    BLOGS_TABLE,
    [Query.equal("status", "published")], // ✅ use Query helper
    String(limit)
  );
  return res.rows.map(formatBlog);
}

// ✅ Get blog by ID
export async function getBlogById(id: string) {
  const row = await tablesDB.getRow(DB_ID, BLOGS_TABLE, id);
  return formatBlog(row);
}

// ✅ Update blog (author or admin)
export async function updateBlog(
  id: string,
  updates: Partial<Blog>,
  imageFiles?: Record<string, { buffer: Buffer; name: string }>
) {
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
    ...(updates.content !== undefined && { content: updates.content }),
    ...(updates.authorId !== undefined && { authorId: updates.authorId }),
    ...(updates.authorRole !== undefined && { authorRole: updates.authorRole }),
    ...(updates.status !== undefined && { status: updates.status }),
    ...imageIds,
  };

  const row = await tablesDB.updateRow(DB_ID, BLOGS_TABLE, id, payload);
  return formatBlog(row);
}

// ✅ Delete blog (author or admin)
export async function deleteBlog(id: string) {
  const row = await tablesDB.getRow(DB_ID, BLOGS_TABLE, id);
  for (const key of IMAGE_KEYS) {
    if (row[key]) {
      await storage.deleteFile(process.env.APPWRITE_BUCKET_ID!, row[key]);
    }
  }
  await tablesDB.deleteRow(DB_ID, BLOGS_TABLE, id);
}

// ✅ Admin publish
export async function publishBlog(id: string) {
  const row = await tablesDB.updateRow(DB_ID, BLOGS_TABLE, id, {
    status: "published",
  });
  return formatBlog(row);
}
