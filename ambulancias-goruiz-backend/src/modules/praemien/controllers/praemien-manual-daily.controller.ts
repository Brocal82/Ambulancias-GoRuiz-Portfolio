import { Request, Response } from "express";
import {
  getMyManualDailyEntryForDay,
  listMyManualDailyEntriesForMonth,
  upsertMyManualDailyEntry,
} from "../services/praemien-manual-daily.service";

export const putMyManualDailyEntry = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const result = await upsertMyManualDailyEntry({
      companyIdStr: req.companyId,
      userId,
      date: req.body?.date,
      workerSubmittedValue: req.body?.workerSubmittedValue,
      status: req.body?.status,
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    res.status(200).json(result.entry);
  } catch (error) {
    console.error("Error en putMyManualDailyEntry:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getMyManualDailyEntriesMonth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const year = Number(req.query.year);
    const month = Number(req.query.month);

    const result = await listMyManualDailyEntriesForMonth({
      companyIdStr: req.companyId,
      userId,
      year,
      month,
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    res.status(200).json(result.entries);
  } catch (error) {
    console.error("Error en getMyManualDailyEntriesMonth:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getMyManualDailyEntryDay = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const date = req.query.date as string | undefined;

    const result = await getMyManualDailyEntryForDay({
      companyIdStr: req.companyId,
      userId,
      date: date ?? "",
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    res.status(200).json(result.entry);
  } catch (error) {
    console.error("Error en getMyManualDailyEntryDay:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
