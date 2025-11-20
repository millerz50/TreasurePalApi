// server/routes/storageRoutes.ts
import express from "express";
import multer from "multer";
import { uploadAvatar } from "../services/storageService"; // or move uploadAvatar into storageService.ts

const router = express.Router();
const upload = multer();

router.post("/api/storage/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileId = await uploadAvatar(req.file);
    res.json({ fileId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
