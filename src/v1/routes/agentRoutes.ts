// server/routes/agentRoutes.ts
import express from "express";
import {
  approveApplicationHandler,
  getMetricsHandler,
  listPendingHandler,
  rejectApplicationHandler,
  submitApplicationHandler,
} from "../controllers/agentController";
import { verifyToken } from "../middleware/verifyToken";

const router = express.Router();

/**
 * Public endpoint for users to submit an agent application.
 * POST /api/agents/apply
 * Body: { accountid, userId?, fullName?, email?, phone?, city?, licenseNumber?, agencyId?, message? }
 */
router.post("/apply", submitApplicationHandler);

/**
 * Admin endpoints (require verifyToken middleware to populate req.user with roles).
 * GET  /api/agents/applications/pending   -> list pending applications
 * POST /api/agents/applications/:id/approve -> approve application
 * POST /api/agents/applications/:id/reject  -> reject application
 */
router.get("/applications/pending", verifyToken, listPendingHandler);

router.post(
  "/applications/:id/approve",
  verifyToken,
  approveApplicationHandler
);

router.post("/applications/:id/reject", verifyToken, rejectApplicationHandler);

/**
 * Agent metrics endpoint
 * GET /api/agents/metrics
 * Expects verifyToken to populate req.agent or req.user
 */
router.get("/metrics", verifyToken, getMetricsHandler);

export default router;
