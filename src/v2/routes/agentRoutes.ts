import express from "express";
import {
  approveApplicationHandler,
  getMetricsHandler,
  listPendingHandler,
  rejectApplicationHandler,
  submitApplicationHandler,
} from "../controllers/agentController";
import { verifyToken, verifyTokenAndAdmin } from "../middleware/verifyToken";

const router = express.Router();

/**
 * Public: submit agent application
 */
router.post("/apply", submitApplicationHandler);

/**
 * Admin-only routes
 */
router.get("/applications/pending", verifyTokenAndAdmin, listPendingHandler);

router.post(
  "/applications/:id/approve",
  verifyTokenAndAdmin,
  approveApplicationHandler
);

router.post(
  "/applications/:id/reject",
  verifyTokenAndAdmin,
  rejectApplicationHandler
);

/**
 * Agent / User metrics
 */
router.get("/metrics", verifyToken, getMetricsHandler);

export default router;
