// server/services/client.ts
import { Client, Databases, Storage } from "node-appwrite";

console.log("🔧 Initializing Appwrite client...");

export const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

export const databases = new Databases(client);
export const storage = new Storage(client);

export const DB_ID = process.env.APPWRITE_DATABASE_ID!;
export const PROPERTIES_COLLECTION =
  process.env.APPWRITE_PROPERTIES_COLLECTION || "properties";
export const USERS_COLLECTION = process.env.APPWRITE_USERTABLE_ID || "users";

console.log(
  "✅ Appwrite client initialized with DB_ID:",
  DB_ID,
  "USERS_COLLECTION:",
  USERS_COLLECTION
);
