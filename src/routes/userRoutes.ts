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

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/signup", upload.single("avatar"), signup);
router.post("/login", loginUser);

router.get("/me", getUserProfile);
router.put("/me", editUser);
router.delete("/me", deleteUser);

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.patch("/:id/role", setRole);
router.patch("/:id/status", setStatus);

export default router;
