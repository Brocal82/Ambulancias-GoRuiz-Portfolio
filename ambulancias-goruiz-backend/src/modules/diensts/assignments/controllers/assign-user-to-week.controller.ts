import { Request, Response } from "express";
import mongoose from "mongoose";
import Dienst from "../../../../models/Dienst";
import {
  findWeeklyConflicts,
  getDriverPscheinState,
  isOnVacationDay,
  isOnSickDay,
} from "../../../../utils/dienstValidation";
import { extractValidDatesFromAssignments } from "../../utils/dienstMappers";

// ✅ Asignar UN USUARIO (driver o medic) a TODA la semana de un Dienst
export const assignUserToWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate, userId, role } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string; // 'YYYY-MM-DD'
      userId?: string;
      role?: "driver" | "medic";
    };

    if (!dienstNumber || !weekStartDate || !userId || !role) {
      res
        .status(400)
        .json({
          message:
            "Faltan parámetros: dienstNumber, weekStartDate, userId, role",
        });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: "userId inválido" });
      return;
    }

    if (role !== "driver" && role !== "medic") {
      res
        .status(400)
        .json({ message: 'Rol inválido. Debe ser "driver" o "medic"' });
      return;
    }

    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    // 🚦 Si es driver, validar P-Schein
    if (role === "driver") {
      const User = mongoose.model("User");
      const u = await User.findById(userId).select("pscheinExpiry").lean();
      if (!u) {
        res.status(404).json({ message: "Usuario no encontrado" });
        return;
      }
      const ps = getDriverPscheinState((u as any)?.pscheinExpiry);
      if (ps === "expired") {
        res.status(409).json({
          code: "pschein_expired",
          message:
            "El P-Schein del conductor está caducado. No se puede asignar.",
        });
        return;
      }
    }

    // 🚧 Conflictos semanales (cualquier Dienst de esa misma semana)
    const weeklyConf = await findWeeklyConflicts(
      new mongoose.Types.ObjectId(userId),
      start,
      dienstNumber,
    );
    if (weeklyConf.length > 0) {
      res.status(409).json({
        code: "weekly_conflict",
        message: "Este usuario ya está asignado a otro Dienst esta semana.",
        details: weeklyConf,
      });
      return;
    }

    // 🔍 Buscar el Dienst de esa semana y número
    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: { $gte: start, $lt: nextDay },
    });

    if (!dienst) {
      res
        .status(404)
        .json({ message: "No existe Dienst para esa semana y número" });
      return;
    }

    // 📅 Días válidos (tienen date/start/end)
    const dates = extractValidDatesFromAssignments(dienst.assignments);

    // 🗓️ Mapas separados para distinguir vacaciones vs baja
    const vacationMap: Record<string, boolean> = {};
    const sickMap: Record<string, boolean> = {};

    await Promise.all(
      dates.map(async (dateISO) => {
        const [isVac, isSick] = await Promise.all([
          isOnVacationDay({ userId, dateISO }),
          isOnSickDay({ userId, dateISO }),
        ]);
        vacationMap[dateISO] = Boolean(isVac);
        sickMap[dateISO] = Boolean(isSick);
      }),
    );

    let updatedCount = 0;
    const skippedByVacation: string[] = [];
    const skippedBreakdown = { sick: 0, vacation: 0, both: 0 };

    dienst.assignments = dienst.assignments.map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;

      const isVac = !!vacationMap[a.date];
      const isSick = !!sickMap[a.date];

      if (isVac || isSick) {
        skippedByVacation.push(a.date);

        if (isVac && isSick) skippedBreakdown.both += 1;
        else if (isSick) skippedBreakdown.sick += 1;
        else if (isVac) skippedBreakdown.vacation += 1;

        return a; // saltar este día
      }

      updatedCount += 1;
      return {
        ...a,
        [role]: new mongoose.Types.ObjectId(userId),
      } as any;
    });

    // ⚠️ Si no se pudo asignar ningún día
    if (updatedCount === 0) {
      const onlySickBlocks =
        skippedBreakdown.sick > 0 &&
        skippedBreakdown.vacation === 0 &&
        skippedBreakdown.both === 0;

      res.status(409).json({
        code: onlySickBlocks ? "no_assignable_days_sick" : "no_assignable_days",
        message: onlySickBlocks
          ? "No se pudo asignar ningún día por baja médica."
          : "No se pudo asignar ningún día (vacaciones u otros filtros).",
        skippedByVacation,
        skippedBreakdown,
      });
      return;
    }

    await dienst.save();

    res.status(200).json({
      message: `Usuario asignado como ${role} a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      updatedCount,
      skippedByVacation,
      skippedBreakdown, // opcional para diagnóstico
      dienstId: dienst.id,
      weekStartDate,
      role,
      userId,
    });
  } catch (error) {
    console.error("❌ Error en assignUserToWeek:", error);
    res
      .status(500)
      .json({ message: "Error al asignar el usuario a la semana" });
  }
};
