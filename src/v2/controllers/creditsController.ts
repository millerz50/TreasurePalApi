// controllers/creditsController.ts
import { Request, Response } from "express";
import {
  addCredits,
  deductCredits,
  getCredits,
} from "../services/user/userService";

/* =========================
   GET CREDITS
========================= */
export async function getCreditsController(req: Request, res: Response) {
  try {
    const accountid = req.params.id;
    if (!accountid) {
      return res.status(400).json({ error: "accountid is required" });
    }

    const credits = await getCredits(accountid);

    return res.status(200).json({
      success: true,
      credits,
    });
  } catch (err: any) {
    console.error("[getCreditsController] ❌", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch credits",
    });
  }
}

/* =========================
   ADD CREDITS
========================= */
export async function addCreditsController(req: Request, res: Response) {
  try {
    const accountid = req.params.id;
    const amount = Number(req.body.amount);

    if (!accountid) {
      return res.status(400).json({ error: "accountid is required" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a positive number" });
    }

    const newBalance = await addCredits(accountid, amount);

    return res.status(200).json({
      success: true,
      message: "Credits added successfully",
      credits: newBalance,
    });
  } catch (err: any) {
    console.error("[addCreditsController] ❌", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to add credits",
    });
  }
}

/* =========================
   DEDUCT / SPEND CREDITS
========================= */
export async function spendCreditsController(req: Request, res: Response) {
  try {
    const accountid = req.params.id;
    const amount = Number(req.body.amount);

    if (!accountid) {
      return res.status(400).json({ error: "accountid is required" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a positive number" });
    }

    const newBalance = await deductCredits(accountid, amount);

    return res.status(200).json({
      success: true,
      message: "Credits deducted successfully",
      credits: newBalance,
    });
  } catch (err: any) {
    console.error("[spendCreditsController] ❌", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to deduct credits",
    });
  }
}
