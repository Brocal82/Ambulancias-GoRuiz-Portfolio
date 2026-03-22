import { Request, Response } from "express";
import { checkVacationsInRangeService } from "../services/vacation-range.service";

export const checkVacationsInRange = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userIds, fromISO, toISO } = req.body;

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
