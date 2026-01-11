import { Router } from "express";
import {
  getAgentMetricsController,
  recordAgentMetricsController,
} from "../controllers/dashboardController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// Protected: compute and return metrics for an agent
router.get("/agent/:id", authMiddleware, getAgentMetricsController);

// Protected: persist metrics snapshot for an agent
router.post("/agent/:id/record", authMiddleware, recordAgentMetricsController);

export default router;
