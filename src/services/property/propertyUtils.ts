// server/services/utils.ts
/**
 * Utility helpers for property service
 */

/* ------------------ Coordinates ------------------ */

/**
 * Parse coordinates from multiple formats into a standard object
 * @param value - Coordinates as [lat, lng], "lat,lng", or { lat, lng } object
 * @returns { locationLat?, locationLng? }
 */
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
    const [latStr, lngStr] = value.split(",");
    const lat = Number(latStr.trim());
    const lng = Number(lngStr.trim());
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { locationLat: lat, locationLng: lng };
    }
  }

  // { lat, lng } / { latitude, longitude } / { locationLat, locationLng }
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    const lat = Number(v.lat ?? v.latitude ?? v.locationLat);
    const lng = Number(v.lng ?? v.longitude ?? v.locationLng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { locationLat: lat, locationLng: lng };
    }
  }

  return {};
}

/* ------------------ Storage ------------------ */

/**
 * Generate Appwrite preview URL for a given fileId
 * @param fileId - Appwrite file ID
 * @returns preview URL or null if not available
 */
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
 * @param value - CSV string
 * @returns array of trimmed strings
 */
export function fromCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
