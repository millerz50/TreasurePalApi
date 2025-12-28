import { Client, Databases, Query } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;
const USERS_COLLECTION = process.env.APPWRITE_USERTABLE_ID!;

export async function validateAgent(agentId: string) {
  console.log("🔎 [validateAgent] Validating agent:", agentId);

  const agentRes = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
    Query.equal("accountid", String(agentId)),
  ]);
  console.log("📊 [validateAgent] Query result total:", agentRes.total);

  const agentDoc = agentRes.total > 0 ? agentRes.documents[0] : null;

  if (
    !agentDoc ||
    !Array.isArray(agentDoc.roles) ||
    !agentDoc.roles.includes("agent")
  ) {
    console.error("❌ [validateAgent] Invalid agent:", agentId);
    throw new Error("Invalid agentId or user is not an agent");
  }

  console.log("✅ [validateAgent] Agent validated:", agentDoc.$id);
  return agentDoc;
}
