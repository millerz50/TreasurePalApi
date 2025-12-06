import { fromCsv, getPreviewUrl, IMAGE_KEYS } from "./utils";

export function formatProperty(row: any) {
  const base = {
    $id: row.$id,
    title: row.title,
    price: row.price,
    location: row.location,
    address: row.address,
    rooms: typeof row.rooms === "number" ? row.rooms : Number(row.rooms || 0),
    description: row.description || "",
    type: row.type || "",
    status: row.status || "pending",
    country: row.country || "",
    amenities: fromCsv(row.amenities),
    locationLat: row.locationLat !== undefined ? Number(row.locationLat) : null,
    locationLng: row.locationLng !== undefined ? Number(row.locationLng) : null,
    agentId: row.agentId,
    published: !!row.published,
    approvedBy: row.approvedBy || null,
    approvedAt: row.approvedAt || null,

    // deposit
    depositAvailable: !!row.depositAvailable,
    depositOption: row.depositOption || "none",
    depositPercentage: row.depositPercentage || null,

    // marketing
    website: row.website || "",
    flyers: row.flyers || "",
    hireDesigner: !!row.hireDesigner,
    designerId: row.designerId || null,
    subscriptionPlan: row.subscriptionPlan || "free",
    whatsappGroup: row.whatsappGroup || "",
    ads: row.ads || "",

    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };

  const images: Record<
    string,
    { fileId: string | null; previewUrl: string | null }
  > = {};
  IMAGE_KEYS.forEach((key) => {
    const fileId = row[key] || null;
    images[key] = { fileId, previewUrl: getPreviewUrl(fileId) };
  });

  return { ...base, images };
}
