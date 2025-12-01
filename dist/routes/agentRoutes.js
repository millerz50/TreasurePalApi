"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/routes/agentRoutes.ts
const express_1 = __importDefault(require("express"));
const agentController_1 = require("../controllers/agentController");
const verifyToken_1 = require("../middleware/verifyToken");
const router = express_1.default.Router();
// GET /api/agent/metrics
router.get("/metrics", verifyToken_1.verifyToken, agentController_1.getMetricsHandler);
exports.default = router;
