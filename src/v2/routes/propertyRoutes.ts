import { Router } from "express";
import multer from "multer";
import {
  approveProperty as approveHandler,
  createProperty as createHandler,
  deleteProperty as deleteHandler,
  getPropertyById as getHandler,
  listHandler,
  updateProperty as updateHandler,
} from "../controllers/propertyController";
import { verifyToken, verifyTokenAndAdmin } from "../middleware/verifyToken";

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage }).fields([
  { name: "frontElevation", maxCount: 1 },
  { name: "southView", maxCount: 1 },
  { name: "westView", maxCount: 1 },
  { name: "eastView", maxCount: 1 },
  { name: "floorPlan", maxCount: 1 },
]);

// -------------------- Public routes --------------------

// List all properties
router.get("/all", listHandler);

// List properties by type ✅ Must come BEFORE /:id
router.get("/type/:type", listHandler);

// Fetch properties by category and optional subType
router.get("/type/:category/:subType?", listHandler);

// Get property by ID
router.get("/:id", getHandler);

// -------------------- Protected: create (agent) --------------------
router.post("/add", verifyToken, upload, createHandler);

// -------------------- Protected: update (owner agent or admin) --------------------
router.put("/:id", verifyToken, upload, updateHandler);

// -------------------- Protected: delete (owner agent or admin) --------------------
router.delete("/:id", verifyToken, deleteHandler);
// ✅ List properties by status (pending, approved, etc)
router.get("/status/:status", listHandler);

// -------------------- Admin: approve/publish property --------------------
router.post("/approve/:id", verifyTokenAndAdmin, approveHandler);

export default router;
