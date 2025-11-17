// server/routes/agentRoutes.ts
import express from "express";
import { getMetricsHandler } from "../controllers/agentController";
import { verifyToken } from "../middleware/verifyToken";

const router = express.Router();

// GET /api/agent/metrics
router.get("/metrics", verifyToken, getMetricsHandler);

export default router;
