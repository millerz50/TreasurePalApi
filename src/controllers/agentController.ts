// server/controllers/agentController.ts
import { NextFunction, Request, Response } from "express";
import {
  approveApplication,
  getApplicationById,
  getUserByAccountId,
  listPendingApplications,
  rejectApplication,
  submitAgentApplication,
} from "../services/user/userService";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";

/**
 * Controller for agent application workflow and metrics wiring.
 *
 * Exports:
 * - submitApplicationHandler  POST /agents/apply
 * - listPendingHandler        GET  /agents/applications/pending   (admin)
 * - approveApplicationHandler POST /agents/applications/:id/approve (admin)
 * - rejectApplicationHandler  POST /agents/applications/:id/reject  (admin)
 * - getMetricsHandler         GET  /agents/metrics                 (agent)
 *
 * Notes:
 * - This file assumes authentication middleware populates req.user (for admins) or req.agent (for agents)
 *   with at least an `accountid` or `$id` and `roles` array when applicable.
 * - Admin-only endpoints perform a simple role check; you may prefer middleware-based authorization.
 */

/* -------------------------
   Helpers
   ------------------------- */

function isAdmin(req: AuthenticatedRequest) {
  const user = (req as any).user;
  if (!user) return false;
  const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
  return roles.includes("admin");
}

/* ============================
   SUBMIT APPLICATION
   POST /agents/apply
   Body: { accountid, userId?, fullName?, email?, phone?, city?, licenseNumber?, agencyId?, message? }
============================ */

export async function submitApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = req.body ?? {};

    // Basic validation
    if (!body.accountid || typeof body.accountid !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "accountid is required" });
    }

    // Optional: ensure user row exists; if not, create or return helpful error.
    // Here we simply submit the application document.
    const created = await submitAgentApplication({
      accountid: body.accountid,
      userId: body.userId,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      city: body.city,
      licenseNumber: body.licenseNumber,
      agencyId: body.agencyId,
      message: body.message,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return next(err);
  }
}

/* ============================
   LIST PENDING APPLICATIONS
   GET /agents/applications/pending
   Admin only
============================ */

export async function listPendingHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const limit = Number(req.query.limit ?? 50);
    const applications = await listPendingApplications(limit);

    return res.status(200).json({ success: true, data: applications });
  } catch (err: any) {
    return next(err);
  }
}

/* ============================
   APPROVE APPLICATION
   POST /agents/applications/:id/approve
   Body: { reviewNotes? }
   Admin only
============================ */

export async function approveApplicationHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const applicationId = req.params.id;
    if (!applicationId) {
      return res
        .status(400)
        .json({ success: false, message: "application id is required" });
    }

    const application = await getApplicationById(applicationId);
    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    // Determine admin identifier for audit (prefer accountid or $id)
    const adminPayload = (req as any).user;
    const adminId =
      adminPayload?.accountid ??
      adminPayload?.$id ??
      adminPayload?.id ??
      "admin";

    const reviewNotes = req.body?.reviewNotes ?? null;

    const result = await approveApplication(
      applicationId,
      adminId,
      reviewNotes
    );

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    return next(err);
  }
}

/* ============================
   REJECT APPLICATION
   POST /agents/applications/:id/reject
   Body: { reviewNotes? }
   Admin only
============================ */

export async function rejectApplicationHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const applicationId = req.params.id;
    if (!applicationId) {
      return res
        .status(400)
        .json({ success: false, message: "application id is required" });
    }

    const application = await getApplicationById(applicationId);
    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    const adminPayload = (req as any).user;
    const adminId =
      adminPayload?.accountid ??
      adminPayload?.$id ??
      adminPayload?.id ??
      "admin";

    const reviewNotes = req.body?.reviewNotes ?? null;

    const result = await rejectApplication(applicationId, adminId, reviewNotes);

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    return next(err);
  }
}

/* ============================
   GET METRICS (existing)
   GET /agents/metrics
   Expects verifyToken middleware to populate req.agent or req.user
============================ */

import {
  getAgentDashboardMetrics,
  recordAgentMetrics,
} from "../services/dashboard/dashboardService";

export async function getMetricsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const agentPayload = (req as any).agent ?? (req as any).user;
    if (
      !agentPayload ||
      (!agentPayload.id && !agentPayload.$id && !agentPayload.accountid)
    ) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const agentId =
      agentPayload.id ?? agentPayload.$id ?? agentPayload.accountid;

    // Optional: quick existence check (non-blocking)
    const userDoc = await getUserByAccountId(
      agentPayload.accountid ?? agentId
    ).catch(() => null);
    if (!userDoc) {
      // Not fatal — you may still want to return 404 or continue depending on your policy
      // Here we continue but include a warning
      console.warn("Agent metrics requested for non-existing user:", agentId);
    }

    const metrics = await getAgentDashboardMetrics(agentId);

    // Persist audit record (await to surface errors)
    await recordAgentMetrics(agentId, metrics);

    return res.status(200).json({ success: true, agentId, metrics });
  } catch (err: any) {
    return next(err);
  }
}
