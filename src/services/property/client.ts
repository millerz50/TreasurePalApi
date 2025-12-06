import { Client, Storage, TablesDB } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);

export const DB_ID = process.env.APPWRITE_DATABASE_ID!;
export const PROPERTIES_TABLE = "properties";
export const USERS_TABLE = process.env.APPWRITE_USERTABLE_ID!;
