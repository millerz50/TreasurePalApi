"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProperties = listProperties;
exports.getPropertyById = getPropertyById;
exports.createProperty = createProperty;
exports.updateProperty = updateProperty;
exports.deleteProperty = deleteProperty;
exports.approveProperty = approveProperty;
const propertyService_1 = require("../services/propertyService");
/**
 * Public: list properties
 */
async function listProperties(_req, res) {
    try {
        const props = await (0, propertyService_1.listProperties)();
        res.json(props);
    }
    catch (err) {
        res
            .status(500)
            .json({ error: "Failed to list properties", details: err.message });
    }
}
/**
 * Public: get one property
 */
async function getPropertyById(req, res) {
    try {
        const prop = await (0, propertyService_1.getPropertyById)(req.params.id);
        if (!prop)
            return res.status(404).json({ error: "Property not found" });
        res.json(prop);
    }
    catch (err) {
        res
            .status(500)
            .json({ error: "Failed to fetch property", details: err.message });
    }
}
/**
 * Protected: create property (agent)
 * Expects req.user (verifyToken) and file parsed by multer at route level.
 */
async function createProperty(req, res) {
    try {
        const user = req.user;
        if (!user || user.role !== "agent")
            return res
                .status(403)
                .json({ error: "Only agents can create properties" });
        const body = { ...req.body, agentId: user.$id };
        // Build imageFiles map if a file was uploaded
        const imageFiles = req.file
            ? {
                frontElevation: {
                    buffer: req.file.buffer,
                    name: req.file.originalname,
                },
            }
            : undefined;
        const property = await (0, propertyService_1.createProperty)(body, imageFiles);
        res.status(201).json(property);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}
/**
 * Protected: update property (owner or admin)
 * Expects req.user (verifyToken) and file parsed by multer at route level.
 */
async function updateProperty(req, res) {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: "Unauthorized" });
        const existing = await (0, propertyService_1.getPropertyById)(req.params.id);
        if (!existing)
            return res.status(404).json({ error: "Property not found" });
        if (user.role !== "admin" && existing.agentId !== user.$id)
            return res.status(403).json({ error: "Forbidden" });
        const imageFiles = req.file
            ? {
                frontElevation: {
                    buffer: req.file.buffer,
                    name: req.file.originalname,
                },
            }
            : undefined;
        const updated = await (0, propertyService_1.updateProperty)(req.params.id, req.body, imageFiles);
        res.json(updated);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}
/**
 * Protected: delete property (owner or admin)
 */
async function deleteProperty(req, res) {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: "Unauthorized" });
        const existing = await (0, propertyService_1.getPropertyById)(req.params.id);
        if (!existing)
            return res.status(404).json({ error: "Property not found" });
        if (user.role !== "admin" && existing.agentId !== user.$id)
            return res.status(403).json({ error: "Forbidden" });
        await (0, propertyService_1.deleteProperty)(req.params.id);
        res.status(204).send();
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}
/**
 * Admin: approve/publish property
 * Expects verifyTokenAndAdmin to have run and set req.user to admin
 */
async function approveProperty(req, res) {
    try {
        const admin = req.user;
        if (!admin || admin.role !== "admin")
            return res.status(403).json({ error: "Admin required" });
        const updates = {
            status: "approved",
            published: true,
            approvedBy: admin.$id,
            approvedAt: new Date().toISOString(),
        };
        const updated = await (0, propertyService_1.updateProperty)(req.params.id, updates);
        res.json(updated);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}
