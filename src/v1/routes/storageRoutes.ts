// server/routes/storageRoutes.ts
import express from "express";
import multer from "multer";
import { uploadToAppwriteBucket } from "../services/storage/storageService";

const router = express.Router();
// use memory storage so req.file.buffer exists
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10_000_000 },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // call the function you imported
    const { fileId, url, raw } = await uploadToAppwriteBucket(
      req.file.buffer,
      req.file.originalname
    );

    // persist fileId to user profile here (example)
    // await userService.saveAvatar(req.user.id, fileId);

    return res.status(201).json({ fileId, url, raw });
  } catch (err: any) {
    console.error("storageRoutes.upload error:", err?.response ?? err);
    return res.status(500).json({ error: err.message || "Upload failed" });
  }
});

export default router;
