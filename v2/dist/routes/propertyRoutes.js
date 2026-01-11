"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/routes/propertyRoutes.ts
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const propertyController_1 = require("../controllers/propertyController");
const verifyToken_1 = require("../middleware/verifyToken");
const router = (0, express_1.Router)();
// ✅ Use memoryStorage for file buffers
const storage = multer_1.default.memoryStorage();
// ✅ Configure Multer with all expected image fields
const upload = (0, multer_1.default)({ storage }).fields([
    { name: "frontElevation", maxCount: 1 },
    { name: "southView", maxCount: 1 },
    { name: "westView", maxCount: 1 },
    { name: "eastView", maxCount: 1 },
    { name: "floorPlan", maxCount: 1 },
]);
// -------------------- Public routes --------------------
router.get("/all", propertyController_1.listProperties);
router.get("/:id", propertyController_1.getPropertyById);
// -------------------- Protected: create (agent) --------------------
router.post("/add", verifyToken_1.verifyToken, upload, propertyController_1.createProperty);
// -------------------- Protected: update (owner agent or admin) --------------------
// ✅ Reuse the same upload config so update accepts the same fields
router.put("/:id", verifyToken_1.verifyToken, upload, propertyController_1.updateProperty);
// -------------------- Protected: delete (owner agent or admin) --------------------
router.delete("/:id", verifyToken_1.verifyToken, propertyController_1.deleteProperty);
// -------------------- Admin: approve/publish property --------------------
router.post("/approve/:id", verifyToken_1.verifyTokenAndAdmin, propertyController_1.approveProperty);
exports.default = router;
