import { Request, Response } from "express";
import { DateTime } from "luxon";
import { checkVacationsInRangeService } from "./vacation-range.service";

const ZONE = "Europe/Berlin";

export const checkVacationsInRange = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userIds, fromISO, toISO } = req.body as {
      userIds?: string[];
      fromISO?: string;
      toISO?: string;
    };

    if (!Array.isArray(userIds) || userIds.length === 0 || !fromISO || !toISO) {
      res
        .status(400)
        .json({
          message:
            "Parámetros inválidos. Se requieren userIds[], fromISO y toISO.",
        });
      return;
    }

    const fromDT = DateTime.fromISO(fromISO, { zone: ZONE }).startOf("day");
    const toDT = DateTime.fromISO(toISO, { zone: ZONE }).endOf("day");

    if (!fromDT.isValid || !toDT.isValid || fromDT > toDT) {
      res.status(400).json({ message: "Rango de fechas inválido." });
      return;
    }

    const result = await checkVacationsInRangeService({
      userIds,
      fromISO,
      toISO,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error en checkVacationsInRange:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
