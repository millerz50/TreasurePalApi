import { NextFunction, Request, Response } from "express";
import {
  getAgentDashboardMetrics,
  recordAgentMetrics,
} from "../services/dashboard/dashboardService";
import {
  approveApplication,
  getApplicationById,
  getUserByAccountId,
  listPendingApplications,
  rejectApplication,
  submitAgentApplication,
} from "../services/user/userService";

/* =========================
   SUBMIT AGENT APPLICATION
========================= */
export async function submitApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = req.body ?? {};

    if (!body.accountid || typeof body.accountid !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "accountid is required" });
    }

    if (!body.fullname || typeof body.fullname !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "fullname is required" });
    }

    if (!body.message || typeof body.message !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "message is required" });
    }

    // All new applications start as unverified
    const payload = {
      accountid: body.accountid,
      fullname: body.fullname,
      message: body.message,
      agentId: body.agentId ?? null,
      rating: body.rating ?? null,
      verified: false, // ✅ default to false
    };

    const created = await submitAgentApplication(payload);

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    return next(err);
  }
}

/* =========================
   LIST PENDING APPLICATIONS (ADMIN)
   Pending = verified === false
========================= */
export async function listPendingHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const limit = Number(req.query.limit ?? 50);

    // fetch applications with verified === false
    const applications = await listPendingApplications(limit);

    return res.status(200).json({ success: true, data: applications });
  } catch (err) {
    return next(err);
  }
}

/* =========================
   APPROVE APPLICATION (ADMIN)
========================= */
export async function approveApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const applicationId = req.params.id;
    if (!applicationId) {
      return res
        .status(400)
        .json({ success: false, message: "Application id is required" });
    }

    const application = await getApplicationById(applicationId);
    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    const adminId = req.accountId!;
    const reviewNotes = req.body?.reviewNotes ?? null;

    const result = await approveApplication(
      applicationId,
      adminId,
      reviewNotes
    );

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

/* =========================
   REJECT APPLICATION (ADMIN)
========================= */
export async function rejectApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const applicationId = req.params.id;
    if (!applicationId) {
      return res
        .status(400)
        .json({ success: false, message: "Application id is required" });
    }

    const application = await getApplicationById(applicationId);
    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    const adminId = req.accountId!;
    const reviewNotes = req.body?.reviewNotes ?? null;

    const result = await rejectApplication(applicationId, adminId, reviewNotes);

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

/* =========================
   GET AGENT DASHBOARD METRICS
========================= */
export async function getMetricsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const accountId = req.accountId!;
    if (!accountId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userDoc = await getUserByAccountId(accountId).catch(() => null);
    if (!userDoc) {
      console.warn("Metrics requested for non-existing user:", accountId);
    }

    const metrics = await getAgentDashboardMetrics(accountId);
    await recordAgentMetrics(accountId, metrics);

    return res.status(200).json({
      success: true,
      agentId: accountId,
      metrics,
    });
  } catch (err) {
    return next(err);
  }
}
