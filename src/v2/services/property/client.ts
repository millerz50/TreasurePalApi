// server/services/client.ts
import { Client, Databases, Storage } from "node-appwrite";

console.log("🔧 Initializing Appwrite client...");

export const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

export const databases = new Databases(client);
export const storage = new Storage(client);

/* ----------------------------- Database config ----------------------------- */

export const DB_ID = process.env.APPWRITE_DATABASE_ID!;

export const PROPERTIES_COLLECTION =
  process.env.APPWRITE_PROPERTIES_COLLECTION || "properties";

export const PROPERTY_MEDIA_COLLECTION =
  process.env.APPWRITE_PROPERTY_MEDIA_COLLECTION || "property_media";

export const USERS_COLLECTION = process.env.APPWRITE_USERTABLE_ID || "users";

/* ---------------------------------- logs ---------------------------------- */

console.log("✅ Appwrite client initialized");
console.log("   DB_ID:", DB_ID);
console.log("   PROPERTIES_COLLECTION:", PROPERTIES_COLLECTION);
console.log("   PROPERTY_MEDIA_COLLECTION:", PROPERTY_MEDIA_COLLECTION);
console.log("   USERS_COLLECTION:", USERS_COLLECTION);
