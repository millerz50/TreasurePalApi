/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import sdk, { Client } from "node-appwrite";

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
   INIT APPWRITE CLIENT (OTP verification)
====================================================== */
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const accounts = new sdk.Account(client);

/* ======================================================
   OTP VERIFICATION
   POST /users/verify-phone
====================================================== */
router.post("/verify-phone", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        message: "Missing userId or otp",
      });
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

/**
 * Replace ALL roles (admin-only)
 * Body: { roles: ["user","agent"] }
 */
router.patch("/:id/roles", authMiddleware, setRoles);

/**
 * Approve Agent (Option C)
 * Admin presses “Approve Agent”
 */
router.post("/:id/approve-agent", authMiddleware, approveAgent);

/**
 * Update user status
 * Body: { status: "Active" | "Pending" | "Suspended" }
 */
router.patch("/:id/status", authMiddleware, setStatus);

/* ======================================================
   💰 CREDITS
====================================================== */
router.get("/:id/credits", authMiddleware, getCreditsController);
router.post("/:id/credits/add", authMiddleware, addCreditsController);
router.post("/:id/credits/spend", authMiddleware, spendCreditsController);

export default router;
