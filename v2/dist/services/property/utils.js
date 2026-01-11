"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_KEYS = void 0;
exports.toCsv = toCsv;
exports.fromCsv = fromCsv;
exports.parseCoordinates = parseCoordinates;
exports.getPreviewUrl = getPreviewUrl;
exports.IMAGE_KEYS = [
    "frontElevation",
    "southView",
    "westView",
    "eastView",
    "floorPlan",
];
function toCsv(value) {
    if (!value)
        return "";
    if (Array.isArray(value))
        return value
            .map(String)
            .map((s) => s.trim())
            .filter(Boolean)
            .join(",");
    return String(value).trim();
}
function fromCsv(value) {
    if (!value)
        return [];
    return String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}
function parseCoordinates(value) {
    if (!value)
        return {};
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
function getPreviewUrl(fileId) {
    if (!fileId)
        return null;
    const endpoint = process.env.APPWRITE_ENDPOINT.replace(/\/$/, "");
    const bucketId = process.env.APPWRITE_BUCKET_ID;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${projectId}`;
}
