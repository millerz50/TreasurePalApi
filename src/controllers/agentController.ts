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
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";

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
============================ */
export async function submitApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = req.body ?? {};

    console.log("submitApplicationHandler: Received body:", body);

    // -----------------------------
    // Validate required fields
    // -----------------------------
    if (!body.userId || typeof body.userId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
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

    // -----------------------------
    // Build Appwrite payload
    // -----------------------------
    const payload = {
      userId: body.userId,
      fullname: body.fullname,
      message: body.message,
      licenseNumber: body.licenseNumber ?? null,
      agencyId: body.agencyId ?? null,
      rating: typeof body.rating === "number" ? body.rating : null,
      verified: typeof body.verified === "boolean" ? body.verified : false,
    };

    console.log("submitApplicationHandler: Payload to DB:", payload);

    // -----------------------------
    // Insert document
    // -----------------------------
    const created = await submitAgentApplication(payload);

    console.log("submitApplicationHandler: Created document:", created);

    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    console.error("submitApplicationHandler: Error:", err);
    return next(err);
  }
}
/* ============================
   LIST PENDING APPLICATIONS
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
    console.error("listPendingHandler: Error:", err);
    return next(err);
  }
}

/* ============================
   APPROVE APPLICATION
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
        .json({ success: false, message: "Application id is required" });
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

    const result = await approveApplication(
      applicationId,
      adminId,
      reviewNotes
    );

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("approveApplicationHandler: Error:", err);
    return next(err);
  }
}

/* ============================
   REJECT APPLICATION
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
        .json({ success: false, message: "Application id is required" });
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
    console.error("rejectApplicationHandler: Error:", err);
    return next(err);
  }
}

/* ============================
   GET AGENT METRICS
============================ */
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

    const userDoc = await getUserByAccountId(
      agentPayload.accountid ?? agentId
    ).catch(() => null);

    if (!userDoc) {
      console.warn("Agent metrics requested for non-existing user:", agentId);
    }

    const metrics = await getAgentDashboardMetrics(agentId);
    await recordAgentMetrics(agentId, metrics);

    return res.status(200).json({ success: true, agentId, metrics });
  } catch (err: any) {
    console.error("getMetricsHandler: Error:", err);
    return next(err);
  }
}
