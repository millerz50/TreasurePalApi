// server/appwrite/appwriteConfig.ts
import dotenv from "dotenv";
import { Client, Databases, TablesDB } from "node-appwrite";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY } =
  process.env;
if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  throw new Error(
    "Missing one of APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY in environment"
  );
}

const normalizedEndpoint = APPWRITE_ENDPOINT.endsWith("/v1")
  ? APPWRITE_ENDPOINT
  : APPWRITE_ENDPOINT.replace(/\/$/, "") + "/v1";

export const appwrite = new Client()
  .setEndpoint(normalizedEndpoint)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY)
  .setSelfSigned(true); // dev only

// export a Databases client (document DB compatibility)
export const databases = new Databases(appwrite);

// export a TablesDB client (relational-style tables API)
export const tables = new TablesDB(appwrite);

// factory helpers if you ever need a client created from a different Client
export function createDatabasesFromClient(c: Client) {
  return new Databases(c);
}
export function createTablesFromClient(c: Client) {
  return new TablesDB(c);
}

export type AppwriteClient = Client;
