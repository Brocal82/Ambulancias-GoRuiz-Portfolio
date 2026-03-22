import { Request, Response } from "express";
import {
  getMonthConfigOrDefault,
  upsertMonthConfigRecord,
} from "../services/month-config.service";

export const getMonthConfig = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const monthKey = String(req.query.monthKey || "");
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      res
        .status(400)
        .json({ message: 'monthKey inválido. Formato "YYYY-MM".' });
      return;
    }

    const cfg = await getMonthConfigOrDefault(monthKey);
    res.status(200).json(cfg);
  } catch (error) {
    console.error("Error al obtener config mensual:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const upsertMonthConfig = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { monthKey, maxPerDay, blackouts } = req.body;

    const updated = await upsertMonthConfigRecord({
      monthKey,
      maxPerDay,
      blackouts,
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error al guardar config mensual:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
