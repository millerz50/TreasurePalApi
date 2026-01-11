"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboardController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protected: compute and return metrics for an agent
router.get("/agent/:id", authMiddleware_1.authMiddleware, dashboardController_1.getAgentMetricsController);
// Protected: persist metrics snapshot for an agent
router.post("/agent/:id/record", authMiddleware_1.authMiddleware, dashboardController_1.recordAgentMetricsController);
exports.default = router;
