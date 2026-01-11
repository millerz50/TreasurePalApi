// server/services/property/propertyValidation.ts
import { Query } from "node-appwrite";
import {
  databases,
  DB_ID,
  USERS_COLLECTION,
} from "../../services/property/client";

/**
 * Validate that the given accountId corresponds to a profile that has the 'agent' role.
 * Returns the profile document on success. Throws a clear Error on failure.
 */
export async function validateAgent(accountId: string) {
  console.log("🔎 [validateAgent] start. accountId:", accountId);

  if (!accountId) {
    console.error("❌ [validateAgent] missing accountId");
    throw new Error("Invalid agent: missing accountId");
  }

  try {
    const res = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
      Query.equal("accountid", String(accountId)),
    ]);

    console.log("📊 [validateAgent] Query result total:", res.total);

    const profile = res.total > 0 ? res.documents[0] : null;
    if (!profile) {
      console.warn(
        "⚠️ [validateAgent] profile not found for accountId:",
        accountId
      );
      throw new Error("Invalid agent: profile not found");
    }

    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    console.log("➡️ [validateAgent] profile roles:", roles);

    if (!roles.includes("agent")) {
      console.warn(
        "⛔ [validateAgent] profile does not include 'agent' role:",
        roles
      );
      throw new Error("Invalid agent: user is not an agent");
    }

    console.log("✅ [validateAgent] validated agent profile $id:", profile.$id);
    return profile;
  } catch (err: any) {
    console.error("❌ [validateAgent] error:", err?.message || err);
    throw new Error(err?.message || "Invalid agent");
  }
}
