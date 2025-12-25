import { Client, Query, TablesDB } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const USERS_TABLE = process.env.APPWRITE_USERTABLE_ID!;

// ✅ Pass client into TablesDB
const tablesDB = new TablesDB(client);

export async function validateAgent(agentId: string) {
  const agentRes = await tablesDB.listRows(DB_ID, USERS_TABLE, [
    Query.equal("accountid", String(agentId)),
  ]);

  const agentDoc = agentRes.total > 0 ? agentRes.rows[0] : null;

  // ✅ Check roles array instead of a single role field
  if (
    !agentDoc ||
    !Array.isArray(agentDoc.roles) ||
    !agentDoc.roles.includes("agent")
  ) {
    throw new Error("Invalid agentId or user is not an agent");
  }

  return agentDoc;
}
