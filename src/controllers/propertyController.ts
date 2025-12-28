// server/controllers/propertyController.ts
import { Request, Response } from "express";
import * as service from "../services/property/propertyService";

/** Helper to extract Multer files */
function extractImages(files: any) {
  if (!files) return undefined;
  const images: Record<string, { buffer: Buffer; name: string }> = {};
  for (const key of Object.keys(files)) {
    const file = files[key][0];
    images[key] = { buffer: file.buffer, name: file.originalname };
  }
  return images;
}

/** Public: list properties */
export async function listProperties(_req: Request, res: Response) {
  console.log("📋 [listProperties] start");
  try {
    const properties = await service.listProperties();
    console.log(
      "✅ [listProperties] fetched",
      Array.isArray(properties) ? properties.length : "unknown",
      "properties"
    );
    return res.json(properties);
  } catch (err: any) {
    console.error(
      "❌ [listProperties] error:",
      err?.message || err,
      err?.stack
    );
    return res
      .status(500)
      .json({ error: err?.message || "Internal Server Error" });
  }
}

/** Public: get property by ID */
export async function getPropertyById(req: Request, res: Response) {
  console.log("🔎 [getPropertyById] id:", req.params.id);
  try {
    const property = await service.getPropertyById(req.params.id);
    if (!property) {
      console.warn("⚠️ [getPropertyById] not found:", req.params.id);
      return res.status(404).json({ error: "Property not found" });
    }
    console.log("✅ [getPropertyById] found:", property.$id ?? "(formatted)");
    return res.json(property);
  } catch (err: any) {
    console.error(
      "❌ [getPropertyById] error:",
      err?.message || err,
      err?.stack
    );
    return res
      .status(500)
      .json({ error: err?.message || "Internal Server Error" });
  }
}

/** Protected: create property (agent) */
export async function createProperty(req: Request, res: Response) {
  console.log("➕ [createProperty] incoming request");
  try {
    // Debug auth context
    console.log("   accountId:", (req as any).accountId);
    console.log("   authUser:", JSON.stringify((req as any).authUser, null, 2));

    const user = req.authUser;
    // Accept users with roles array that includes 'agent'
    if (!user || !Array.isArray(user.roles) || !user.roles.includes("agent")) {
      console.warn("⛔ [createProperty] access denied. roles:", user?.roles);
      return res
        .status(403)
        .json({ error: "Only agents can create properties" });
    }

    const accountId = req.accountId ?? user.id;
    if (!accountId) {
      console.error("❌ [createProperty] missing accountId on request");
      return res
        .status(401)
        .json({ error: "Unauthorized: missing account id" });
    }

    // Extract and debug files
    const images = extractImages(req.files);
    console.log(
      "   extracted images keys:",
      images ? Object.keys(images) : "none"
    );

    // Debug payload summary (avoid logging sensitive fields)
    const payloadSummary = {
      title: req.body?.title,
      price: req.body?.price,
      location: req.body?.location,
      agentIdField: req.body?.agentId,
    };
    console.log("   payload summary:", payloadSummary);

    const property = await service.createProperty(req.body, accountId, images);

    // Log created document permissions if available
    try {
      // property may be formatted; attempt to log raw permission info if present
      console.log(
        "✅ [createProperty] created property id:",
        property?.$id ?? "(no id)"
      );
      if ((property as any)?.$permissions) {
        console.log(
          "   $permissions:",
          JSON.stringify((property as any).$permissions)
        );
      } else if ((property as any)?.images) {
        console.log(
          "   images keys in returned property:",
          Object.keys((property as any).images || {})
        );
      }
    } catch (logErr) {
      console.warn(
        "⚠️ [createProperty] could not log created property details:",
        logErr
      );
    }

    return res.status(201).json(property);
  } catch (err: any) {
    console.error(
      "❌ [createProperty] error:",
      err?.message || err,
      err?.stack
    );
    // Distinguish permission/validation errors
    if (err.message && /agent|forbidden|unauthorized/i.test(err.message)) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(400).json({ error: err?.message || "Bad request" });
  }
}

/** Protected: update property (owner or admin) */
export async function updateProperty(req: Request, res: Response) {
  console.log("✏️ [updateProperty] id:", req.params.id);
  try {
    console.log("   accountId:", (req as any).accountId);
    console.log("   authUser:", JSON.stringify((req as any).authUser, null, 2));

    const user = req.authUser;
    if (!user) {
      console.warn("⛔ [updateProperty] unauthorized");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const images = extractImages(req.files);
    console.log(
      "   extracted images keys:",
      images ? Object.keys(images) : "none"
    );

    const isAdmin = Array.isArray(user.roles) && user.roles.includes("admin");
    console.log("   isAdmin:", isAdmin);

    const property = await service.updateProperty(
      req.params.id,
      req.body,
      user.id,
      isAdmin,
      images
    );

    console.log("✅ [updateProperty] updated:", property?.$id ?? "(formatted)");
    return res.json(property);
  } catch (err: any) {
    console.error(
      "❌ [updateProperty] error:",
      err?.message || err,
      err?.stack
    );
    return res.status(400).json({ error: err?.message || "Bad request" });
  }
}

/** Protected: delete property (owner or admin) */
export async function deleteProperty(req: Request, res: Response) {
  console.log("🗑 [deleteProperty] id:", req.params.id);
  try {
    console.log("   accountId:", (req as any).accountId);
    console.log("   authUser:", JSON.stringify((req as any).authUser, null, 2));

    const user = req.authUser;
    if (!user) {
      console.warn("⛔ [deleteProperty] unauthorized");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Optionally check role here if you want only admin/owner to delete
    await service.deleteProperty(req.params.id);
    console.log("✅ [deleteProperty] deleted:", req.params.id);
    return res.status(204).send();
  } catch (err: any) {
    console.error(
      "❌ [deleteProperty] error:",
      err?.message || err,
      err?.stack
    );
    return res.status(400).json({ error: err?.message || "Bad request" });
  }
}

/** Admin: approve/publish property */
export async function approveProperty(req: Request, res: Response) {
  console.log("✅ [approveProperty] id:", req.params.id);
  try {
    console.log("   accountId:", (req as any).accountId);
    console.log("   authUser:", JSON.stringify((req as any).authUser, null, 2));

    const admin = req.authUser;
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
      approvedBy: admin.id,
      approvedAt: new Date().toISOString(),
    };

    const property = await service.updateProperty(
      req.params.id,
      updates,
      admin.id,
      true
    );

    console.log(
      "✅ [approveProperty] published:",
      property?.$id ?? "(formatted)"
    );
    return res.json(property);
  } catch (err: any) {
    console.error(
      "❌ [approveProperty] error:",
      err?.message || err,
      err?.stack
    );
    return res.status(400).json({ error: err?.message || "Bad request" });
  }
}
