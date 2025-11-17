// server/controllers/propertyController.ts
import { Request, Response } from "express";
import {
  createProperty as svcCreateProperty,
  deleteProperty as svcDeleteProperty,
  getPropertyById as svcGetPropertyById,
  listProperties as svcListProperties,
  updateProperty as svcUpdateProperty,
} from "../services/propertyService";

/**
 * Public: list properties
 */
export async function listProperties(_req: Request, res: Response) {
  try {
    const props = await svcListProperties();
    res.json(props);
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to list properties", details: err.message });
  }
}

/**
 * Public: get one property
 */
export async function getPropertyById(req: Request, res: Response) {
  try {
    const prop = await svcGetPropertyById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });
    res.json(prop);
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch property", details: err.message });
  }
}

/**
 * Protected: create property (agent)
 * Expects req.user (verifyToken) and file parsed by multer at route level.
 */
export async function createProperty(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user || user.role !== "agent")
      return res
        .status(403)
        .json({ error: "Only agents can create properties" });

    const body = { ...req.body, agentId: user.$id };
    const property = await svcCreateProperty(
      body,
      req.file?.buffer,
      req.file?.originalname
    );
    res.status(201).json(property);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * Protected: update property (owner or admin)
 * Expects req.user (verifyToken) and file parsed by multer at route level.
 */
export async function updateProperty(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const existing = await svcGetPropertyById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Property not found" });

    if (user.role !== "admin" && existing.agentId !== user.$id)
      return res.status(403).json({ error: "Forbidden" });

    const updated = await svcUpdateProperty(
      req.params.id,
      req.body,
      req.file?.buffer,
      req.file?.originalname
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * Protected: delete property (owner or admin)
 */
export async function deleteProperty(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const existing = await svcGetPropertyById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Property not found" });

    if (user.role !== "admin" && existing.agentId !== user.$id)
      return res.status(403).json({ error: "Forbidden" });

    await svcDeleteProperty(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * Admin: approve/publish property
 * Expects verifyTokenAndAdmin to have run and set req.user to admin
 */
export async function approveProperty(req: Request, res: Response) {
  try {
    const admin = (req as any).user;
    if (!admin || admin.role !== "admin")
      return res.status(403).json({ error: "Admin required" });

    const updates = {
      status: "approved",
      published: true,
      approvedBy: admin.$id,
      approvedAt: new Date().toISOString(),
    };

    const updated = await svcUpdateProperty(req.params.id, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
