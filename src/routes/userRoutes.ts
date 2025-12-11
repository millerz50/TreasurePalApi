/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import {
  deleteUser,
  editUser,
  getAgents,
  getAllUsers,
  getUserById,
  getUserProfile,
  loginUser,
  setRole,
  setStatus,
  signup,
  updateUser,
} from "../controllers/userController";
import { authMiddleware } from "../middleware/authMiddleware";

import sdk, { Client } from "node-appwrite";

const router = express.Router();

// -------------------------------------------------------
// INIT APPWRITE CLIENT (for OTP verification route)
// -------------------------------------------------------
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const accounts = new sdk.Account(client);

// -------------------------------------------------------
// 🚀 OTP VERIFICATION (POST /users/verify-phone)
// -------------------------------------------------------
router.post("/verify-phone", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        message: "Missing userId or otp",
      });
    }

    // Try verifying OTP
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

// -------------------------------------------------------
// Existing User Routes
// -------------------------------------------------------
router.post("/signup", signup);
router.post("/login", loginUser);

router.get("/me", authMiddleware, getUserProfile);

router.put("/:id", editUser);
router.delete("/:id", deleteUser);

router.get("/", getAllUsers);
router.get("/agents", getAgents);
router.get("/:id", getUserById);

router.patch("/:id/role", setRole);
router.patch("/:id/status", setStatus);
router.put("/:id", updateUser);

export default router;
