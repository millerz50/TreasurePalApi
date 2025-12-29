// server/services/utils.ts
/**
 * Utility helpers for property service
 */

/* ------------------ Coordinates ------------------ */

export function parseCoordinates(value: unknown): {
  locationLat?: number;
  locationLng?: number;
} {
  if (value === undefined || value === null) return {};

  // [lat, lng]
  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { locationLat: lat, locationLng: lng };
    }
  }

  // "lat,lng"
  if (typeof value === "string") {
    const [lat, lng] = value.split(",").map((v) => Number(v.trim()));

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { locationLat: lat, locationLng: lng };
    }
  }

  // { lat, lng } / { latitude, longitude }
  if (typeof value === "object") {
    const v = value as any;
    const lat = Number(v.lat ?? v.latitude ?? v.locationLat);
    const lng = Number(v.lng ?? v.longitude ?? v.locationLng);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { locationLat: lat, locationLng: lng };
    }
  }

  return {};
}

/* ------------------ Storage ------------------ */

export function getPreviewUrl(
  fileId: string | null | undefined
): string | null {
  if (!fileId) return null;

  const endpoint = (process.env.APPWRITE_ENDPOINT || "").replace(/\/+$/, "");
  const bucketId = process.env.APPWRITE_BUCKET_ID;
  const projectId = process.env.APPWRITE_PROJECT_ID;

  if (!endpoint || !bucketId || !projectId) return null;

  return `${endpoint}/storage/buckets/${encodeURIComponent(
    bucketId
  )}/files/${encodeURIComponent(fileId)}/preview?project=${encodeURIComponent(
    projectId
  )}`;
}

/* ------------------ CSV ------------------ */

/**
 * Converts a comma-separated string into an array of trimmed strings
 * @param value string | null | undefined
 */
export function fromCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
