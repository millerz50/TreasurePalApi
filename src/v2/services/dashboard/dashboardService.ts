import { Client, ID } from "node-appwrite";

const APPWRITE_ENDPOINT = (process.env.APPWRITE_ENDPOINT || "").trim();
const APPWRITE_PROJECT_ID = (process.env.APPWRITE_PROJECT_ID || "").trim();
const APPWRITE_API_KEY = (process.env.APPWRITE_API_KEY || "").trim();
const DB_ID = (process.env.APPWRITE_DATABASE_ID || "treasuredataid").trim();
const PROPERTIES_COLLECTION = (
  process.env.APPWRITE_PROPERTIES_COLLECTION_ID || "properties"
).trim();
const USER_TABLE_ID = (process.env.APPWRITE_USERTABLE_ID || "userid").trim();
const BUCKET_ID = (process.env.APPWRITE_BUCKET_ID || "userAvatars").trim();
const METRICS_COLLECTION = (
  process.env.APPWRITE_METRICS_COLLECTION_ID || "agentMetricRecords"
).trim();

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

/** Build URL for Tables endpoints */
function buildTablesUrl(path: string): URL {
  const base = APPWRITE_ENDPOINT.replace(/\/$/, "");
  const hasV1 = /\/v1(\/|$)/.test(base);
  return new URL(hasV1 ? `${base}${path}` : `${base}/v1${path}`);
}

/** Fetch documents from Appwrite Tables */
async function fetchDocumentsTables(
  databaseId: string,
  collectionId: string,
): Promise<{ total: number; documents: any[] }> {
  try {
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`;
    const url = buildTablesUrl(path);

    const res = await client.call("get", url, {});
    const documents = Array.isArray(res.documents) ? res.documents : [];
    const total = typeof res.total === "number" ? res.total : documents.length;
    return { total, documents };
  } catch (err: any) {
    console.error(
      `fetchDocumentsTables error for ${collectionId}:`,
      err?.message ?? err,
    );
    return { total: 0, documents: [] };
  }
}

/** Compute agent metrics dynamically from properties */
export async function getAgentDashboardMetrics(agentId: string) {
  if (!agentId) throw new Error("agentId is required");

  try {
    const propsRes = await fetchDocumentsTables(DB_ID, PROPERTIES_COLLECTION);
    const props = propsRes.documents.filter(
      (d: any) => String(d.agentId) === String(agentId),
    );

    const propertiesCount = props.length;

    const ratings: number[] = props
      .map((d: any) => Number(d.rating))
      .filter((r: number) => Number.isFinite(r));

    const averagePropertyRating: number | null =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((a: number, b: number) => a + b, 0) /
              ratings.length) *
              10,
          ) / 10
        : null;

    const leadsCount: number = props.reduce(
      (acc: number, d: any) => acc + (d.leads || 0),
      0,
    );
    const conversionRate: number | null =
      leadsCount > 0
        ? props.reduce((acc: number, d: any) => acc + (d.conversions || 0), 0) /
          leadsCount
        : null;

    return {
      agentId,
      propertiesCount,
      averagePropertyRating,
      historicalMetricRecords: props.length,
      leadsCount,
      conversionRate,
      lastComputedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("getAgentDashboardMetrics error:", err?.message ?? err);
    throw new Error(
      `Failed to compute metrics: ${err?.message ?? String(err)}`,
    );
  }
}

/** Persist metrics (optional, requires METRICS_COLLECTION) */
export async function recordAgentMetrics(agentId: string, metrics: any) {
  if (!agentId) throw new Error("agentId is required");
  if (!metrics) throw new Error("metrics payload is required");

  try {
    const doc = await client.call(
      "post",
      buildTablesUrl(
        `/databases/${DB_ID}/collections/${METRICS_COLLECTION}/documents`,
      ),
      {},
      {
        documentId: ID.unique(),
        data: { agentId, metrics, recordedAt: new Date().toISOString() },
      },
    );
    return doc;
  } catch (err: any) {
    console.error("recordAgentMetrics error:", err?.message ?? err);
    throw new Error(
      `Failed to persist metrics: ${err?.message ?? String(err)}`,
    );
  }
}

/** Fetch user profile by $id */
export async function getUserProfileByUserId(userId: string) {
  if (!userId) throw new Error("userId is required");

  try {
    const res = await fetchDocumentsTables(DB_ID, USER_TABLE_ID);
    return (
      res.documents.find((d: any) => String(d.$id) === String(userId)) ?? null
    );
  } catch (err: any) {
    console.error("getUserProfileByUserId error:", err?.message ?? err);
    return null;
  }
}

/** Build avatar URL for a stored file */
export function buildAvatarUrl(fileId?: string) {
  if (!fileId || !APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !BUCKET_ID)
    return null;
  const base = APPWRITE_ENDPOINT.replace(/\/v1\/?$/, "");
  return `${base}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

// ✅ Named exports
export default {
  getAgentDashboardMetrics,
  getUserProfileByUserId,
  buildAvatarUrl,
  recordAgentMetrics,
};
