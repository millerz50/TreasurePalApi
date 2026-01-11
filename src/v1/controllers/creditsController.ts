import { Request, Response } from "express";
import {
  addCredits,
  deductCredits,
  getCredits,
} from "../services/user/userService";

export async function getCreditsController(req: Request, res: Response) {
  const { id } = req.params;
  const credits = await getCredits(id);
  res.json({ credits });
}

export async function addCreditsController(req: Request, res: Response) {
  const { id } = req.params;
  const { amount, reason } = req.body;

  await addCredits(id, Number(amount), reason);
  res.json({ status: "SUCCESS" });
}

export async function spendCreditsController(req: Request, res: Response) {
  const { id } = req.params;
  const { amount, reason } = req.body;

  await deductCredits(id, Number(amount), reason);
  res.json({ status: "SUCCESS" });
}
