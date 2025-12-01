"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/routes/storageRoutes.ts
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const storageService_1 = require("../services/storageService");
const router = express_1.default.Router();
// use memory storage so req.file.buffer exists
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10_000_000 },
});
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        // call the function you imported
        const { fileId, url, raw } = await (0, storageService_1.uploadToAppwriteBucket)(req.file.buffer, req.file.originalname);
        // persist fileId to user profile here (example)
        // await userService.saveAvatar(req.user.id, fileId);
        return res.status(201).json({ fileId, url, raw });
    }
    catch (err) {
        console.error("storageRoutes.upload error:", err?.response ?? err);
        return res.status(500).json({ error: err.message || "Upload failed" });
    }
});
exports.default = router;
