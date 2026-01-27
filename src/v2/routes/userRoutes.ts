// routes/userRoutes.ts
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

import { verifyToken, verifyTokenAndAdmin } from "../middleware/verifyToken";

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
====================================================== */
router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const bucketId = process.env.APPWRITE_BUCKET_ID!;
    const uploaded = await storage.createFile(
      bucketId,
      ID.unique(),
      req.file.buffer as any,
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
});

/* ======================================================
   OTP VERIFICATION
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
router.get("/me", verifyToken, getUserProfile);

/* ======================================================
   USERS (ADMIN ONLY)
====================================================== */
router.get("/", verifyTokenAndAdmin, getAllUsers);
router.get("/agents", verifyTokenAndAdmin, getAgents);
router.get("/:id", verifyTokenAndAdmin, getUserById);

router.put("/:id", verifyTokenAndAdmin, updateUser);
router.patch("/:id", verifyTokenAndAdmin, editUser);
router.delete("/:id", verifyTokenAndAdmin, deleteUser);

/* ======================================================
   ADMIN — ROLE & STATUS
====================================================== */
router.patch("/:id/roles", verifyTokenAndAdmin, setRoles);
router.post("/:id/approve-agent", verifyTokenAndAdmin, approveAgent);
router.patch("/:id/status", verifyTokenAndAdmin, setStatus);

/* ======================================================
   💰 CREDITS
   - Agents can GET and SPEND their own credits
   - Admins can ADD credits
====================================================== */
// Agent or admin can view their own credits
router.get("/:id/credits", verifyToken, getCreditsController);

// Admin-only: add credits to any account
router.post("/:id/credits/add", verifyTokenAndAdmin, addCreditsController);

// Agent or admin can spend/deduct credits from their own account
router.post("/:id/credits/spend", verifyToken, spendCreditsController);

export default router;
