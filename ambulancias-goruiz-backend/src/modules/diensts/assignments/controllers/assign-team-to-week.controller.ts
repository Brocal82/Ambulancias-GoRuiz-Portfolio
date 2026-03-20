import { Request, Response } from "express";
import mongoose from "mongoose";
import Dienst from "../../../../models/Dienst";
import Team from "../../../../models/Team";
import {
  computeDayBlockMapForTeam,
  findWeeklyConflicts,
  getDriverPscheinState,
} from "../../../../utils/dienstValidation";
import { extractValidDatesFromAssignments } from "../../utils/dienstMappers";

// ✅ Asignar TEAM a la semana:
//    - Si hay CUALQUIER conflicto semanal (driver o medic en otro Dienst): ABORTAR (409).
//    - Vacaciones: seguir aplicando de forma parcial por día/rol.
//    - Excepción P-Schein driver caducado si driver=both y el compañero puede conducir.
//    - Si el front envía resolvedRoles (driverId/medicId), los usamos (por ejemplo, tras un swap seguro).
export const assignTeamToWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { dienstNumber, weekStartDate, teamId, resolvedRoles } = req.body as {
      dienstNumber?: number;
      weekStartDate?: string;
      teamId?: string;
      resolvedRoles?: {
        driverId?: string;
        medicId?: string;
      };
    };

    if (!dienstNumber || !weekStartDate || !teamId) {
      res
        .status(400)
        .json({
          message: "Faltan parámetros: dienstNumber, weekStartDate, teamId",
        });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      res.status(400).json({ message: "teamId inválido" });
      return;
    }

    const team = await Team.findById(teamId)
      .populate("driver", "pscheinExpiry ambulanceRole")
      .populate("medic", "pscheinExpiry ambulanceRole")
      .lean();

    if (!team) {
      res.status(404).json({ message: "Team no encontrado" });
      return;
    }

    const toIdString = (v: any): string | undefined =>
      typeof v === "string"
        ? v
        : v && typeof v === "object" && v._id
          ? String(v._id)
          : undefined;

    const teamDriverId = toIdString((team as any).driver);
    const teamMedicId = toIdString((team as any).medic);

    if (!teamDriverId || !teamMedicId) {
      res.status(400).json({ message: "Team inválido: faltan driver o medic" });
      return;
    }

    // 🚑 Ambulancia fija del team (opcional)
    const teamAmbulanceId: mongoose.Types.ObjectId | null = (team as any)
      .ambulanceId
      ? new mongoose.Types.ObjectId(String((team as any).ambulanceId))
      : null;

    // 🔀 Aplicar resolvedRoles si vienen del front (ej. swap pre-calculado en el modal)
    let driverId = teamDriverId;
    let medicId = teamMedicId;

    if (resolvedRoles && (resolvedRoles.driverId || resolvedRoles.medicId)) {
      const rDriverId = resolvedRoles.driverId;
      const rMedicId = resolvedRoles.medicId;

      if (!rDriverId || !rMedicId) {
        res.status(400).json({
          message:
            "resolvedRoles incompletos: deben incluir driverId y medicId",
        });
        return;
      }

      // Deben ser exactamente los dos miembros del team y no pueden ser el mismo
      const validIds = new Set([teamDriverId, teamMedicId]);
      if (
        !validIds.has(rDriverId) ||
        !validIds.has(rMedicId) ||
        rDriverId === rMedicId
      ) {
        res.status(400).json({
          message: "resolvedRoles inválidos para este team",
        });
        return;
      }

      driverId = rDriverId;
      medicId = rMedicId;
    }

    // 🔍 Elegir qué doc es driverDoc y cuál es medicDoc según los IDs finales
    const rawDriverDoc = (team as any).driver;
    const rawMedicDoc = (team as any).medic;

    const driverDoc =
      rawDriverDoc && toIdString(rawDriverDoc) === driverId
        ? rawDriverDoc
        : rawMedicDoc;
    const medicDoc =
      rawMedicDoc && toIdString(rawMedicDoc) === medicId
        ? rawMedicDoc
        : rawDriverDoc;

    if (!driverDoc || !medicDoc) {
      res.status(400).json({
        message:
          "No se pudieron resolver correctamente driverDoc/medicDoc para el team",
      });
      return;
    }

    const driverRole = driverDoc?.ambulanceRole as
      | "driver"
      | "medic"
      | "both"
      | undefined;
    const medicRole = medicDoc?.ambulanceRole as
      | "driver"
      | "medic"
      | "both"
      | undefined;

    const driverPschein = getDriverPscheinState(driverDoc?.pscheinExpiry);
    const medicPschein = getDriverPscheinState(medicDoc?.pscheinExpiry);

    const medicCanDrive =
      (medicRole === "driver" || medicRole === "both") &&
      (medicPschein === "valid" || medicPschein === "warning");
    const driverIsBoth = driverRole === "both";

    let driverExpiredButBothHint = false;

    // ⛔ Validación P-Schein del CONDUCTOR final
    if (driverPschein === "expired") {
      if (driverIsBoth && medicCanDrive) {
        // Permitimos excepción, pero avisamos al front para que considere swap de roles
        driverExpiredButBothHint = true;
      } else {
        res.status(409).json({
          code: "pschein_expired",
          message:
            "El P-Schein del conductor está caducado. No se puede asignar el equipo.",
        });
        return;
      }
    }

    // Semana/Dienst
    const start = new Date(weekStartDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ message: "weekStartDate inválida" });
      return;
    }

    const dienst = await Dienst.findOne({
      dienstNumber,
      weekStartDate: {
        $gte: start,
        $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    if (!dienst) {
      res
        .status(404)
        .json({ message: "No existe Dienst para esa semana y número" });
      return;
    }

    // 🔒 CONFLICTOS SEMANALES (BLOQUEAMOS SI HAY CUALQUIERA)
    const [driverConf, medicConf] = await Promise.all([
      findWeeklyConflicts(
        new mongoose.Types.ObjectId(driverId),
        start,
        dienstNumber,
      ),
      findWeeklyConflicts(
        new mongoose.Types.ObjectId(medicId),
        start,
        dienstNumber,
      ),
    ]);

    if ((driverConf?.length ?? 0) > 0 || (medicConf?.length ?? 0) > 0) {
      res.status(409).json({
        code: "weekly_conflict",
        message:
          "Alguno de los miembros ya está asignado a otro Dienst esta semana.",
        details: { driverConf, medicConf },
      });
      return; // 🚫 no asignamos NADA
    }

    // ✅ Si NO hay conflictos, aplicamos (parcial solo por vacaciones)
    const dates = extractValidDatesFromAssignments(dienst.assignments);

    // 🩺 Bloqueos por día: vacaciones o baja (sick)
    const dayBlockMap = await computeDayBlockMapForTeam({
      driverId,
      medicId,
      dates,
    });

    let updatedCount = 0;
    // mantenemos el mismo array por compatibilidad con el front
    const skippedByVacation: Array<{ date: string; role: "driver" | "medic" }> =
      [];

    dienst.assignments = (dienst.assignments || []).map((a) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;

      const dateISO = a.date;
      const block = dayBlockMap[dateISO] || { driver: false, medic: false };

      let next = { ...a } as any;
      let changed = false;

      // 🚗 Asignar conductor si no está bloqueado
      if (!block.driver) {
        const newId = new mongoose.Types.ObjectId(driverId);
        if (!next.driver || String(next.driver) !== String(newId)) {
          next.driver = newId;
          changed = true;
        }
      } else {
        skippedByVacation.push({ date: dateISO, role: "driver" });
      }

      // 🧑‍⚕️ Asignar sanitario si no está bloqueado
      if (!block.medic) {
        const newId = new mongoose.Types.ObjectId(medicId);
        if (!next.medic || String(next.medic) !== String(newId)) {
          next.medic = newId;
          changed = true;
        }
      } else {
        skippedByVacation.push({ date: dateISO, role: "medic" });
      }

      // 🚑 Ambulancia fija del team (sin pisar manual)
      if (teamAmbulanceId && !next.ambulanceId) {
        next.ambulanceId = teamAmbulanceId;
        changed = true;
      }

      if (changed) updatedCount += 1;
      return next;
    });

    // ✅ Guardar ancla semanal del Team para rotación futura (robusto aunque haya sick/vac)
    (dienst as any).weekTeamId = new mongoose.Types.ObjectId(teamId);

    await dienst.save();

    res.status(200).json({
      message: `Team asignado a ${updatedCount} días del Dienst #${dienstNumber} (${weekStartDate}).`,
      updatedCount,
      skippedByVacation,
      dienstId: dienst.id,
      weekStartDate,
      hints: { driverExpiredButBoth: !!driverExpiredButBothHint },
    });
  } catch (error) {
    console.error("❌ Error en assignTeamToWeek:", error);
    res.status(500).json({ message: "Error al asignar el Team a la semana" });
  }
};
