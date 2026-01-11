import { NextFunction, Request, Response } from "express";

/* =========================
   Types
========================= */

export type UserWithRoles = {
  $id: string;
  roles?: string[];
  status?: string;
};

/* =========================
   Helpers
========================= */

function hasRole(user: UserWithRoles, role: string) {
  return Array.isArray(user.roles) && user.roles.includes(role);
}

function requireAuthUser(req: Request): UserWithRoles {
  const user = (req as any).user as UserWithRoles | undefined;

  if (!user) {
    const err: any = new Error("Authentication required");
    err.status = 401;
    throw err;
  }

  if (user.status && user.status !== "Active") {
    const err: any = new Error("Account not active");
    err.status = 403;
    throw err;
  }

  return user;
}

/* =========================
   Guards
========================= */

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    requireAuthUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = requireAuthUser(req);

      if (!user.roles || !allowedRoles.some((role) => hasRole(user, role))) {
        const err: any = new Error(
          `Access denied. Required role: ${allowedRoles.join(", ")}`
        );
        err.status = 403;
        throw err;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/* =========================
   Convenience Guards
========================= */

export const requireAdmin = requireRole("admin");

export const requireAgent = requireRole("agent");

export const requireAgentOrAdmin = requireRole("agent", "admin");

export const requireBlogger = requireRole("blogger");

export const requireMarketer = requireRole("marketer");

export const requireDesigner = requireRole("designer");

export const requireInvestor = requireRole("investor");
