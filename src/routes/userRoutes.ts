// server/routes/userRoutes.ts
import express from "express";
import multer from "multer";
import {
  deleteUser,
  editUser,
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
const upload = multer({ storage: multer.memoryStorage() });

router.post("/signup", upload.single("avatar"), signup);
router.post("/login", loginUser);

// 🔑 Current user (requires accountId via middleware)
router.get("/me", authMiddleware, getUserProfile);

router.put("/:id", editUser);
router.delete("/:id", deleteUser);

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.patch("/:id/role", setRole);
router.patch("/:id/status", setStatus);
router.put("/:id", updateUser); // keep if you want full replace

export default router;
