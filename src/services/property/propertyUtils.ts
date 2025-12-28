// server/services/utils.ts
/**
 * Utility helpers for property service
 */

export function toCsv(value: unknown): string {
  console.log("🔄 [toCsv] Converting:", value);
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v))
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
  }
  return String(value).trim();
}

export function fromCsv(value: unknown): string[] {
  console.log("🔄 [fromCsv] Converting:", value);
  if (value === undefined || value === null) return [];
  const str = String(value).trim();
  if (!str) return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseCoordinates(value: unknown): {
  locationLat?: number;
  locationLng?: number;
} {
  console.log("📍 [parseCoordinates] Parsing:", value);
  if (value === undefined || value === null) return {};

  // If array-like [lat, lng]
  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { locationLat: lat, locationLng: lng };
    }
  }

  // If string "lat,lng" or "lat, lng"
  if (typeof value === "string") {
    const parts = value
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return { locationLat: lat, locationLng: lng };
      }
    }
  }

  // If object with numeric keys { lat, lng } or { latitude, longitude }
  if (typeof value === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = value as any;
    const latCandidates = [v.lat, v.latitude, v.locationLat];
    const lngCandidates = [v.lng, v.longitude, v.locationLng];
    const lat = latCandidates.map(Number).find((n) => !Number.isNaN(n));
    const lng = lngCandidates.map(Number).find((n) => !Number.isNaN(n));
    if (lat !== undefined && lng !== undefined) {
      return { locationLat: Number(lat), locationLng: Number(lng) };
    }
  }

  return {};
}

export function getPreviewUrl(
  fileId: string | null | undefined
): string | null {
  if (!fileId) return null;

  const endpoint = (process.env.APPWRITE_ENDPOINT || "").replace(/\/+$/, "");
  const bucketId = process.env.APPWRITE_BUCKET_ID;
  const projectId = process.env.APPWRITE_PROJECT_ID;

  if (!endpoint || !bucketId || !projectId) {
    console.warn("🌐 [getPreviewUrl] Missing Appwrite configuration");
    return null;
  }

  const encodedId = encodeURIComponent(fileId);
  const url = `${endpoint}/storage/buckets/${encodeURIComponent(
    bucketId
  )}/files/${encodedId}/preview?project=${encodeURIComponent(projectId)}`;

  console.log("🌐 [getPreviewUrl] Generated preview URL:", url);
  return url;
}
