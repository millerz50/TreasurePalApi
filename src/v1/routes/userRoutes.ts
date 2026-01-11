/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import multer from "multer";
import sdk, { Client, ID } from "node-appwrite";

import {
  approveAgent,
  deleteUser,
  editUser,
  getAgents,
  getAllUsers,
  getUserById,
  getUserProfile,
  loginUser,
  setRoles,
  setStatus,
  signup,
  updateUser,
} from "../controllers/userController";

import {
  addCreditsController,
  getCreditsController,
  spendCreditsController,
} from "../controllers/creditsController";

import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

/* ======================================================
   INIT APPWRITE CLIENT
====================================================== */
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const accounts = new sdk.Account(client);
const storage = new sdk.Storage(client);

/* ======================================================
   MULTER CONFIG
====================================================== */
const upload = multer({ storage: multer.memoryStorage() });

/* ======================================================
   FILE UPLOAD (Avatar / Profile Image)
   POST /users/upload
====================================================== */
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const bucketId = process.env.APPWRITE_BUCKET_ID!;
      // Cast buffer to any so TS stops expecting a browser File
      const uploaded = await storage.createFile(
        bucketId,
        ID.unique(),
        req.file.buffer as any
      );

      return res.json({
        status: "SUCCESS",
        fileId: uploaded.$id,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || "File upload failed",
      });
    }
  }
);

/* ======================================================
   OTP VERIFICATION
   POST /users/verify-phone
====================================================== */
router.post("/verify-phone", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: "Missing userId or otp" });
    }

    await accounts.updatePhoneSession(userId, otp);

    return res.json({
      status: "SUCCESS",
      message: "Phone verified",
      userId,
    });
  } catch (err: any) {
    return res.status(400).json({
      message: err?.message || "Invalid OTP",
    });
  }
});

/* ======================================================
   AUTH
====================================================== */
router.post("/signup", signup);
router.post("/login", loginUser);

/* ======================================================
   PROFILE
====================================================== */
router.get("/me", authMiddleware, getUserProfile);

/* ======================================================
   USERS
====================================================== */
router.get("/", authMiddleware, getAllUsers);
router.get("/agents", authMiddleware, getAgents);
router.get("/:id", authMiddleware, getUserById);

router.put("/:id", authMiddleware, updateUser);
router.patch("/:id", authMiddleware, editUser);
router.delete("/:id", authMiddleware, deleteUser);

/* ======================================================
   ADMIN — ROLE & STATUS
====================================================== */
router.patch("/:id/roles", authMiddleware, setRoles);
router.post("/:id/approve-agent", authMiddleware, approveAgent);
router.patch("/:id/status", authMiddleware, setStatus);

/* ======================================================
   💰 CREDITS
====================================================== */
router.get("/:id/credits", authMiddleware, getCreditsController);
router.post("/:id/credits/add", authMiddleware, addCreditsController);
router.post("/:id/credits/spend", authMiddleware, spendCreditsController);

export default router;
