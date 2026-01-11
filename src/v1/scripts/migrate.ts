import "dotenv/config";
import { Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DATABASE_ID = "treasuredataid";

async function createCollection(id: string, name: string) {
  try {
    await databases.getCollection(DATABASE_ID, id);
    console.log(`✓ ${id} exists`);
  } catch {
    await databases.createCollection(DATABASE_ID, id, name);
    console.log(`+ Created ${id}`);
  }
}

async function attr(fn: () => Promise<any>) {
  try {
    await fn();
  } catch {}
}

async function run() {
  /* USERS */
  await createCollection("users", "Users");
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "users",
      "accountid",
      255,
      true
    )
  );
  await attr(() =>
    databases.createEmailAttribute(DATABASE_ID, "users", "email", true)
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "users",
      "firstName",
      200,
      true
    )
  );
  await attr(() =>
    databases.createStringAttribute(DATABASE_ID, "users", "surname", 200, true)
  );
  await attr(() =>
    databases.createStringAttribute(DATABASE_ID, "users", "status", 50, false)
  );
  await attr(() =>
    databases.createStringAttribute(DATABASE_ID, "users", "phone", 255, false)
  );
  await attr(() =>
    databases.createStringAttribute(DATABASE_ID, "users", "country", 255, false)
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "users",
      "location",
      255,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "users",
      "dateOfBirth",
      255,
      false
    )
  );
  await attr(() =>
    databases.createIntegerAttribute(DATABASE_ID, "users", "credits", false)
  );
  await attr(() =>
    databases.createDatetimeAttribute(
      DATABASE_ID,
      "users",
      "lastLoginReward",
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "users",
      "roles",
      50,
      false,
      undefined,
      true
    )
  );

  /* COMPANIES */
  await createCollection("companies", "Companies");
  await attr(() =>
    databases.createStringAttribute(DATABASE_ID, "companies", "name", 255, true)
  );
  await attr(() =>
    databases.createStringAttribute(DATABASE_ID, "companies", "type", 50, false)
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "companies",
      "registrationNumber",
      255,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "companies",
      "country",
      255,
      false
    )
  );
  await attr(() =>
    databases.createBooleanAttribute(
      DATABASE_ID,
      "companies",
      "verified",
      false
    )
  );
  await attr(() =>
    databases.createIntegerAttribute(DATABASE_ID, "companies", "rating", false)
  );

  /* COMPANY MEMBERS */
  await createCollection("company_members", "Company Members");
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "company_members",
      "companyId",
      255,
      true
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "company_members",
      "userId",
      255,
      true
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "company_members",
      "role",
      50,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "company_members",
      "status",
      50,
      false
    )
  );

  /* AGENT PROFILES */
  await createCollection("agent_profiles", "Agent Profiles");
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "agent_profiles",
      "userId",
      255,
      true
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "agent_profiles",
      "licenseNumber",
      255,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "agent_profiles",
      "agencyId",
      255,
      false
    )
  );
  await attr(() =>
    databases.createIntegerAttribute(
      DATABASE_ID,
      "agent_profiles",
      "rating",
      false
    )
  );
  await attr(() =>
    databases.createBooleanAttribute(
      DATABASE_ID,
      "agent_profiles",
      "verified",
      false
    )
  );

  /* PROPERTIES */
  await createCollection("properties", "Properties");
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "properties",
      "title",
      255,
      true
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "properties",
      "type",
      50,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "properties",
      "status",
      50,
      false
    )
  );
  await attr(() =>
    databases.createIntegerAttribute(DATABASE_ID, "properties", "price", false)
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "properties",
      "location",
      255,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "properties",
      "ownerId",
      255,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "properties",
      "agentId",
      255,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "properties",
      "companyId",
      255,
      false
    )
  );

  /* PROPERTY MEDIA */
  await createCollection("property_media", "Property Media");
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "property_media",
      "propertyId",
      255,
      true
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "property_media",
      "type",
      50,
      false
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "property_media",
      "url",
      255,
      true
    )
  );
  await attr(() =>
    databases.createStringAttribute(
      DATABASE_ID,
      "property_media",
      "createdBy",
      255,
      false
    )
  );

  console.log("✅ MIGRATION COMPLETE");
}

run();
