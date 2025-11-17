import dotenv from "dotenv";
import { Client, Storage, TablesDB } from "node-appwrite";
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
  .setSelfSigned(true); // dev/local only

export const storage = new Storage(appwrite);
export const tables = new TablesDB(appwrite); // <-- export instance named `tables`

export type AppwriteClient = Client;
