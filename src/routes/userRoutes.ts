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

const router = express.Router();

// 🚀 Signup now only expects JSON body, no avatar upload required
router.post("/signup", signup);
router.post("/login", loginUser);

// 🔑 Current user (requires accountId via middleware)
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
