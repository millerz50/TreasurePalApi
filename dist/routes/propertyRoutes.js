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
const verifyTokenAndAdmin_1 = require("../middleware/verifyTokenAndAdmin");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Public
router.get("/all", propertyController_1.listProperties);
router.get("/:id", propertyController_1.getPropertyById);
// Protected: create (agent)
router.post("/add", verifyToken_1.verifyToken, upload.single("image"), propertyController_1.createProperty);
// Protected: update (owner agent or admin)
router.put("/:id", verifyToken_1.verifyToken, upload.single("image"), propertyController_1.updateProperty);
// Protected: delete (owner agent or admin)
router.delete("/:id", verifyToken_1.verifyToken, propertyController_1.deleteProperty);
// Admin: approve/publish property
router.post("/approve/:id", verifyTokenAndAdmin_1.verifyTokenAndAdmin, propertyController_1.approveProperty);
exports.default = router;
