import { Router } from "express";
import {
  getAgentMetricsController,
  recordAgentMetricsController,
} from "../controllers/dashboardController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

// Protected: compute and return metrics for an agent
router.get("/agent/:id", verifyToken, getAgentMetricsController);

// Protected: persist metrics snapshot for an agent
router.post("/agent/:id/record", verifyToken, recordAgentMetricsController);

export default router;
