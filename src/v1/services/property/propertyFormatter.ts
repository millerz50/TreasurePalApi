// server/utils/propertyFormatter.ts
import { IMAGE_KEYS } from "./propertyImages";
import { fromCsv, getPreviewUrl } from "./propertyUtils";

/**
 * Format a property row from the database into a structured object
 * @param row Raw property object from DB
 * @returns Formatted property with images
 */
export function formatProperty(row: any) {
  if (!row) {
    console.warn("⚠️ [formatProperty] Received empty row");
    return null;
  }

  console.log("📝 [formatProperty] Formatting row:", row?.$id);

  // Base property fields
  const base = {
    $id: row.$id,
    title: row.title || "",
    price: typeof row.price === "number" ? row.price : Number(row.price || 0),
    location: row.location || "",
    address: row.address || "",
    rooms: typeof row.rooms === "number" ? row.rooms : Number(row.rooms || 0),
    description: row.description || "",
    type: row.type || "",
    status: row.status || "pending",
    country: row.country || "",
    amenities: Array.isArray(row.amenities)
      ? row.amenities
      : fromCsv(row.amenities || ""),
    locationLat:
      row.locationLat !== undefined && row.locationLat !== null
        ? Number(row.locationLat)
        : null,
    locationLng:
      row.locationLng !== undefined && row.locationLng !== null
        ? Number(row.locationLng)
        : null,
    agentId: row.agentId || null,
    published: !!row.published,
    approvedBy: row.approvedBy || null,
    approvedAt: row.approvedAt || null,
    depositAvailable: !!row.depositAvailable,
    depositOption: row.depositOption || "none",
    depositPercentage:
      row.depositPercentage !== undefined && row.depositPercentage !== null
        ? Number(row.depositPercentage)
        : null,
    website: row.website || "",
    flyers: row.flyers || "",
    hireDesigner: !!row.hireDesigner,
    designerId: row.designerId || null,
    subscriptionPlan: row.subscriptionPlan || "free",
    whatsappGroup: row.whatsappGroup || "",
    ads: row.ads || "",
    createdAt: row.$createdAt || null,
    updatedAt: row.$updatedAt || null,
  };

  console.log("ℹ️ [formatProperty] Base property data:", base);

  // Process images
  const images: Record<
    string,
    { fileId: string | null; previewUrl: string | null }
  > = {};

  IMAGE_KEYS.forEach((key) => {
    const fileId = row[key] || null;
    const previewUrl = getPreviewUrl(fileId);
    images[key] = { fileId, previewUrl };
    console.log(
      `🖼 [formatProperty] Image key=${key} fileId=${fileId} previewUrl=${previewUrl}`
    );
  });

  console.log("✅ [formatProperty] Finished formatting property:", base.$id);

  return { ...base, images };
}
