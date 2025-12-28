export function toCsv(value: any): string {
  console.log("🔄 [toCsv] Converting:", value);
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
  console.log("🔄 [fromCsv] Converting:", value);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseCoordinates(value: any): {
  locationLat?: number;
  locationLng?: number;
} {
  console.log("📍 [parseCoordinates] Parsing:", value);
  if (!value) return {};
  if (Array.isArray(value) && value.length >= 2) {
    const [lat, lng] = value.map(Number);
    if (!Number.isNaN(lat) && !Number.isNaN(lng))
      return { locationLat: lat, locationLng: lng };
  }
  if (typeof value === "string" && value.includes(",")) {
    const [latS, lngS] = value.split(",");
    const lat = Number(latS),
      lng = Number(lngS);
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
  const url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${projectId}`;
  console.log("🌐 [getPreviewUrl] Generated preview URL:", url);
  return url;
}
