export const IMAGE_KEYS = [
  "frontElevation",
  "southView",
  "westView",
  "eastView",
  "floorPlan",
] as const;

export function toCsv(value: any): string {
  if (!value) return "";
  if (Array.isArray(value))
    return value
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
  return String(value).trim();
}

export function fromCsv(value: any): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseCoordinates(value: any) {
  if (!value) return {};
  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng))
      return { locationLat: lat, locationLng: lng };
  }
  if (typeof value === "string" && value.includes(",")) {
    const [latS, lngS] = value.split(",");
    const lat = Number(latS);
    const lng = Number(lngS);
    if (!Number.isNaN(lat) && !Number.isNaN(lng))
      return { locationLat: lat, locationLng: lng };
  }
  return {};
}

export function getPreviewUrl(fileId: string | null): string | null {
  if (!fileId) return null;
  const endpoint = process.env.APPWRITE_ENDPOINT!.replace(/\/$/, "");
  const bucketId = process.env.APPWRITE_BUCKET_ID!;
  const projectId = process.env.APPWRITE_PROJECT_ID!;
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${projectId}`;
}
