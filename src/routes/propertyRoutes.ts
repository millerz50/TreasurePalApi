// server/routes/propertyRoutes.ts
import { Router } from "express";
import multer from "multer";
import {
  approveProperty as approveHandler,
  createProperty as createHandler,
  deleteProperty as deleteHandler,
  getPropertyById as getHandler,
  listProperties as listHandler,
  updateProperty as updateHandler,
} from "../controllers/propertyController";
import { verifyToken } from "../middleware/verifyToken";
import { verifyTokenAndAdmin } from "../middleware/verifyTokenAndAdmin";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public
router.get("/all", listHandler);
router.get("/:id", getHandler);

// Protected: create (agent)
router.post("/add", verifyToken, upload.single("image"), createHandler);

// Protected: update (owner agent or admin)
router.put("/:id", verifyToken, upload.single("image"), updateHandler);

// Protected: delete (owner agent or admin)
router.delete("/:id", verifyToken, deleteHandler);

// Admin: approve/publish property
router.post("/approve/:id", verifyTokenAndAdmin, approveHandler);

export default router;
