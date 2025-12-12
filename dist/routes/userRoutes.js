"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const node_appwrite_1 = __importStar(require("node-appwrite"));
const router = express_1.default.Router();
// -------------------------------------------------------
// INIT APPWRITE CLIENT (for OTP verification route)
// -------------------------------------------------------
const client = new node_appwrite_1.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const accounts = new node_appwrite_1.default.Account(client);
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
    }
    catch (err) {
        return res.status(400).json({
            message: err?.message || "Invalid OTP",
        });
    }
});
// -------------------------------------------------------
// Existing User Routes
// -------------------------------------------------------
router.post("/signup", userController_1.signup);
router.post("/login", userController_1.loginUser);
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
