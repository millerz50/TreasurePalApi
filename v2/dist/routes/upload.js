"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uploadToAppwrite_1 = require("../lib/uploadToAppwrite");
const upload_1 = require("../middleware/upload");
const router = express_1.default.Router();
router.post("/upload", upload_1.upload.single("image"), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: "No file uploaded" });
        const url = await (0, uploadToAppwrite_1.uploadToAppwriteBucket)(req.file.buffer, req.file.originalname);
        return res.json({ url });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
