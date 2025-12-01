"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// 🚀 Signup now only expects JSON body, no avatar upload required
router.post("/signup", userController_1.signup);
router.post("/login", userController_1.loginUser);
// 🔑 Current user (requires accountId via middleware)
router.get("/me", authMiddleware_1.authMiddleware, userController_1.getUserProfile);
router.put("/:id", userController_1.editUser);
router.delete("/:id", userController_1.deleteUser);
router.get("/", userController_1.getAllUsers);
router.get("/agents", userController_1.getAgents);
router.get("/:id", userController_1.getUserById);
router.patch("/:id/role", userController_1.setRole);
router.patch("/:id/status", userController_1.setStatus);
router.put("/:id", userController_1.updateUser);
exports.default = router;
