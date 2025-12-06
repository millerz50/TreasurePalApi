import { Request, Response } from "express";
import {
  createProperty as svcCreateProperty,
  deleteProperty as svcDeleteProperty,
  getPropertyById as svcGetPropertyById,
  listProperties as svcListProperties,
  updateProperty as svcUpdateProperty,
} from "../services/property/propertyService";

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
 */
export async function createProperty(req: Request, res: Response) {
  try {
    // 🔍 Debug: log token and user
    console.log("Authorization header:", req.headers.authorization);
    console.log("Parsed authUser:", req.authUser);

    const user = req.authUser;
    if (!user || user.role !== "agent") {
      return res
        .status(403)
        .json({ error: "Only agents can create properties" });
    }

    const body = { ...req.body, agentId: user.id };

    const imageFiles = req.file
      ? {
          frontElevation: {
            buffer: req.file.buffer,
            name: req.file.originalname,
          },
        }
      : undefined;

    const property = await svcCreateProperty(body, imageFiles);
    res.status(201).json(property);
  } catch (err: any) {
    console.error("❌ Error in createProperty:", err);
    res.status(400).json({ error: err.message });
  }
}

/**
 * Protected: update property (owner or admin)
 */
export async function updateProperty(req: Request, res: Response) {
  try {
    console.log("Authorization header:", req.headers.authorization);
    console.log("Parsed authUser:", req.authUser);

    const user = req.authUser;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const existing = await svcGetPropertyById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Property not found" });

    if (user.role !== "admin" && existing.agentId !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const imageFiles = req.file
      ? {
          frontElevation: {
            buffer: req.file.buffer,
            name: req.file.originalname,
          },
        }
      : undefined;

    const updated = await svcUpdateProperty(
      req.params.id,
      req.body,
      imageFiles
    );
    res.json(updated);
  } catch (err: any) {
    console.error("❌ Error in updateProperty:", err);
    res.status(400).json({ error: err.message });
  }
}

/**
 * Protected: delete property (owner or admin)
 */
export async function deleteProperty(req: Request, res: Response) {
  try {
    console.log("Authorization header:", req.headers.authorization);
    console.log("Parsed authUser:", req.authUser);

    const user = req.authUser;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const existing = await svcGetPropertyById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Property not found" });

    if (user.role !== "admin" && existing.agentId !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await svcDeleteProperty(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    console.error("❌ Error in deleteProperty:", err);
    res.status(400).json({ error: err.message });
  }
}

/**
 * Admin: approve/publish property
 */
export async function approveProperty(req: Request, res: Response) {
  try {
    console.log("Authorization header:", req.headers.authorization);
    console.log("Parsed authUser:", req.authUser);

    const admin = req.authUser;
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin required" });
    }

    const updates = {
      status: "approved",
      published: true,
      approvedBy: admin.id,
      approvedAt: new Date().toISOString(),
    };

    const updated = await svcUpdateProperty(req.params.id, updates);
    res.json(updated);
  } catch (err: any) {
    console.error("❌ Error in approveProperty:", err);
    res.status(400).json({ error: err.message });
  }
}
