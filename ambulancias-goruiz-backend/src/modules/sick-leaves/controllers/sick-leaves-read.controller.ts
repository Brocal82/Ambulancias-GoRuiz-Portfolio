import { Request, Response } from "express";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { getAuthUserId } from "../utils/sick-auth.helpers";
import { getMySickLeaves, getSickLeaves } from "../services/sick-leaves-read.service";
import { checkSickInRangeService } from "../services/sick-range.service";

const ZONE = "Europe/Berlin";

export async function listSickLeaves(req: Request, res: Response) {
  try {
    const { status, user } = req.query as { status?: string; user?: string };
    const items = await getSickLeaves({ status, user });

    res.status(200).json(items);
  } catch (err) {
    console.error("\u274C listSickLeaves error:", err);
    res.status(500).json({ message: "Error al listar las bajas" });
  }
}

export async function listMySickLeaves(req: Request, res: Response) {
  try {
    const authId = getAuthUserId(req);
    if (!authId || !mongoose.Types.ObjectId.isValid(authId)) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const { status } = req.query as { status?: string };
    const items = await getMySickLeaves({ userId: authId, status });
    res.status(200).json(items);
  } catch (err) {
    console.error("\u274C listMySickLeaves error:", err);
    res.status(500).json({ message: "Error al listar tus bajas" });
  }
}

export async function checkSickInRange(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { userIds, fromISO, toISO, includeFullSpan } = req.body as {
      userIds?: string[];
      fromISO?: string;
      toISO?: string;
      includeFullSpan?: boolean;
    };

    if (!Array.isArray(userIds) || userIds.length === 0 || !fromISO || !toISO) {
      res
        .status(400)
        .json({
          message:
            "Par\u00E1metros inv\u00E1lidos. Se requieren userIds[], fromISO y toISO.",
        });
      return;
    }

    const fromStart = DateTime.fromISO(fromISO, { zone: ZONE }).startOf("day");
    const toEnd = DateTime.fromISO(toISO, { zone: ZONE }).endOf("day");
    if (!fromStart.isValid || !toEnd.isValid || toEnd < fromStart) {
      res.status(400).json({ message: "Rango de fechas inv\u00E1lido." });
      return;
    }

    const result = await checkSickInRangeService({
      userIds,
      fromISO,
      toISO,
      includeFullSpan,
    });

    if (result.kind === "invalid_user_ids") {
      res.status(400).json({ message: "userIds inv\u00E1lidos." });
      return;
    }

    res.status(200).json(result.result);
  } catch (err) {
    console.error("\u274C checkSickInRange error:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}
