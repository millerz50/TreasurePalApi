import { Request, Response } from "express";
import * as service from "../services/property/propertyService";

/* -------------------- Helpers -------------------- */

/** Extract Multer files into a usable object */
function extractImages(files: Express.Multer.File[] | any) {
  if (!files) return undefined;
  const images: Record<string, { buffer: Buffer; name: string }> = {};
  for (const key of Object.keys(files)) {
    const file = files[key][0];
    images[key] = { buffer: file.buffer, name: file.originalname };
  }
  return images;
}

/** Safely extract an error message */
function getErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try {
    const anyErr = err as any;
    if (anyErr?.message) return anyErr.message;
    return JSON.stringify(anyErr);
  } catch {
    return String(err);
  }
}

/* -------------------- Public Endpoints -------------------- */

/** List all properties or by type */
export async function listHandler(req: Request, res: Response) {
  const type = (req.params as any).type; // undefined if not filtering
  console.log("📋 [listHandler] type:", type);

  try {
    const properties = await service.listProperties(type);
    console.log(
      "✅ [listHandler] fetched",
      Array.isArray(properties) ? properties.length : "unknown",
      "properties",
    );
    return res.json(properties);
  } catch (err: unknown) {
    console.error("❌ [listHandler] error:", getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err) });
  }
}

/** Get property by ID */
export async function getPropertyById(req: Request, res: Response) {
  const { id } = req.params;
  console.log("🔎 [getPropertyById] id:", id);

  try {
    const property = await service.getPropertyById(id);
    if (!property) {
      console.warn("⚠️ [getPropertyById] not found:", id);
      return res.status(404).json({ error: "Property not found" });
    }

    console.log(
      "✅ [getPropertyById] found:",
      (property as any)?.$id ?? "(formatted)",
    );
    return res.json(property);
  } catch (err: unknown) {
    console.error("❌ [getPropertyById] error:", getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err) });
  }
}

/* -------------------- Protected Endpoints -------------------- */

/** Create a new property (agent only) */
export async function createProperty(req: Request, res: Response) {
  console.log("➕ [createProperty] incoming request");

  try {
    const user = (req as any).authUser;
    const accountId = (req as any).accountId ?? user?.id;

    if (!user || !Array.isArray(user.roles) || !user.roles.includes("agent")) {
      console.warn("⛔ [createProperty] access denied. roles:", user?.roles);
      return res
        .status(403)
        .json({ error: "Only agents can create properties" });
    }

    if (!accountId) {
      console.error("❌ [createProperty] missing accountId on request");
      return res
        .status(401)
        .json({ error: "Unauthorized: missing account id" });
    }

    const images = extractImages(req.files);
    console.log(
      "   extracted images keys:",
      images ? Object.keys(images) : "none",
    );

    const payloadSummary = {
      title: req.body?.title,
      price: req.body?.price,
      location: req.body?.location,
      agentIdField: req.body?.agentId,
    };
    console.log("   payload summary:", payloadSummary);

    const property = await service.createProperty(req.body, accountId, images);

    console.log(
      "✅ [createProperty] created property id:",
      (property as any)?.$id ?? "(no id)",
    );

    return res.status(201).json(property);
  } catch (err: unknown) {
    console.error("❌ [createProperty] error:", getErrorMessage(err));
    const msg = getErrorMessage(err);
    if (/agent|forbidden|unauthorized/i.test(msg)) {
      return res.status(403).json({ error: msg });
    }
    return res.status(400).json({ error: msg || "Bad request" });
  }
}

/** Update an existing property (owner or admin) */
export async function updateProperty(req: Request, res: Response) {
  const { id } = req.params;
  console.log("✏️ [updateProperty] id:", id);

  try {
    const user = (req as any).authUser;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const accountId = (req as any).accountId ?? user.id;
    const isAdmin = Array.isArray(user.roles) && user.roles.includes("admin");

    const images = extractImages(req.files);
    console.log(
      "   extracted images keys:",
      images ? Object.keys(images) : "none",
    );
    console.log("   isAdmin:", isAdmin);

    const property = await service.updateProperty(
      id,
      req.body,
      accountId,
      isAdmin,
      images,
    );

    console.log(
      "✅ [updateProperty] updated:",
      (property as any)?.$id ?? "(formatted)",
    );
    return res.json(property);
  } catch (err: unknown) {
    console.error("❌ [updateProperty] error:", getErrorMessage(err));
    return res.status(400).json({ error: getErrorMessage(err) });
  }
}

/** Delete a property (owner or admin) */
export async function deleteProperty(req: Request, res: Response) {
  const { id } = req.params;
  console.log("🗑 [deleteProperty] id:", id);

  try {
    const user = (req as any).authUser;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const accountId = (req as any).accountId ?? user.id;
    const isAdmin = Array.isArray(user.roles) && user.roles.includes("admin");

    await service.deleteProperty(id, accountId, isAdmin);

    console.log("✅ [deleteProperty] deleted:", id);
    return res.status(204).send();
  } catch (err: unknown) {
    console.error("❌ [deleteProperty] error:", getErrorMessage(err));
    return res.status(400).json({ error: getErrorMessage(err) });
  }
}

/** Approve/publish property (admin only) */
export async function approveProperty(req: Request, res: Response) {
  const { id } = req.params;
  console.log("✅ [approveProperty] id:", id);

  try {
    const admin = (req as any).authUser;
    const accountId = (req as any).accountId ?? admin?.id;

    if (
      !admin ||
      !Array.isArray(admin.roles) ||
      !admin.roles.includes("admin")
    ) {
      console.warn("⛔ [approveProperty] admin required. roles:", admin?.roles);
      return res.status(403).json({ error: "Admin required" });
    }

    const updates = {
      published: true,
      approvedBy: accountId,
      approvedAt: new Date().toISOString(),
    };

    const property = await service.updateProperty(id, updates, accountId, true);

    console.log(
      "✅ [approveProperty] published:",
      (property as any)?.$id ?? "(formatted)",
    );
    return res.json(property);
  } catch (err: unknown) {
    console.error("❌ [approveProperty] error:", getErrorMessage(err));
    return res.status(400).json({ error: getErrorMessage(err) });
  }
}
