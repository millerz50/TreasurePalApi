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
  try {
    const properties = await service.listProperties();
    res.json(properties);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/** Public: get property by ID */
export async function getPropertyById(req: Request, res: Response) {
  try {
    const property = await service.getPropertyById(req.params.id);
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/** Protected: create property (agent) */
export async function createProperty(req: Request, res: Response) {
  try {
    const user = req.authUser;
    if (!user || user.role !== "agent")
      return res
        .status(403)
        .json({ error: "Only agents can create properties" });

    const images = extractImages(req.files);
    const property = await service.createProperty(req.body, user.id, images);
    res.status(201).json(property);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

/** Protected: update property (owner or admin) */
export async function updateProperty(req: Request, res: Response) {
  try {
    const user = req.authUser;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const images = extractImages(req.files);
    const property = await service.updateProperty(
      req.params.id,
      req.body,
      user.id,
      user.role === "admin",
      images
    );

    res.json(property);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

/** Protected: delete property (owner or admin) */
export async function deleteProperty(req: Request, res: Response) {
  try {
    const user = req.authUser;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    await service.deleteProperty(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

/** Admin: approve/publish property */
export async function approveProperty(req: Request, res: Response) {
  try {
    const admin = req.authUser;
    if (!admin || admin.role !== "admin")
      return res.status(403).json({ error: "Admin required" });

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
    res.json(property);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
