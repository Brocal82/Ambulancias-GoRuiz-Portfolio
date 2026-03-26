//src/utils/cleanupOldDiensts.ts

import { DateTime } from "luxon";
import mongoose from "mongoose";
import { Dienst } from "../modules/diensts";

// Zona horaria oficial del servicio
const ZONE = "Europe/Berlin";

/**
 * Calcula el "próximo lunes 00:00" en la zona Europe/Berlin,
 * relativo al momento de ejecución.
 */
function getNextMondayStart(): DateTime {
  const now = DateTime.now().setZone(ZONE);
  // ISO week en Luxon empieza en LUNES por defecto.
  const thisMonday = now.startOf("week"); // lunes 00:00 de esta semana
  // Si ya pasamos del domingo, "próximo lunes" es el mismo thisMonday + 1 semana;
  // si estamos antes del lunes 00:00, sigue siendo el thisMonday próximo.
  const nextMonday =
    now < thisMonday ? thisMonday : thisMonday.plus({ weeks: 1 });
  return nextMonday.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
}

/**
 * Dado un assignment (date=YYYY-MM-DD, start/end HH:mm),
 * devuelve el DateTime de fin REAL en zona Berlin (sumando 1 día si cruza medianoche).
 */
function getAssignmentEnd(
  dateISO: string,
  startHHmm: string,
  endHHmm: string,
): DateTime {
  const base = DateTime.fromISO(dateISO, { zone: ZONE }).startOf("day");
  const [sh, sm] = startHHmm.split(":").map(Number);
  const [eh, em] = endHHmm.split(":").map(Number);

  const start = base.set({
    hour: sh ?? 0,
    minute: sm ?? 0,
    second: 0,
    millisecond: 0,
  });
  let end = base.set({
    hour: eh ?? 0,
    minute: em ?? 0,
    second: 0,
    millisecond: 0,
  });

  // Si la hora de fin es <= hora de inicio, asumimos que cruza medianoche (turno nocturno)
  if (end <= start) {
    end = end.plus({ days: 1 });
  }
  return end;
}

/**
 * Misma lógica de limpieza que antes, acotada a un companyId.
 */
async function cleanupOldDienstsForCompany(
  companyId: mongoose.Types.ObjectId,
  nextMondayStart: DateTime,
  nextMondayStartUTC: DateTime,
): Promise<number> {
  const candidates = await Dienst.find(
    {
      companyId,
      weekEndDate: { $lt: nextMondayStartUTC.toJSDate() },
    },
    { assignments: 1 },
  ).lean();

  if (!candidates.length) {
    return 0;
  }

  const deletableIds: mongoose.Types.ObjectId[] = [];

  for (const d of candidates as any[]) {
    if (!Array.isArray(d.assignments) || d.assignments.length === 0) {
      deletableIds.push(d._id);
      continue;
    }

    let maxEnd: DateTime | null = null;

    for (const a of d.assignments) {
      if (!a?.date || !a?.startTime || !a?.endTime) continue;
      const end = getAssignmentEnd(a.date, a.startTime, a.endTime);
      if (!maxEnd || end > maxEnd) maxEnd = end;
    }

    if (!maxEnd) continue;

    if (maxEnd < nextMondayStart) {
      deletableIds.push(d._id);
    }
  }

  if (!deletableIds.length) {
    return 0;
  }

  const result = await Dienst.deleteMany({
    _id: { $in: deletableIds },
    companyId,
  });
  return result.deletedCount ?? 0;
}

/**
 * Limpia Diensts ANTIGUOS cuyo último assignment haya terminado ANTES del próximo lunes 00:00 Berlin.
 * - No borra Diensts con turnos nocturnos del domingo que terminan la madrugada del lunes.
 * - Ejecuta la misma lógica por cada companyId (multitenant).
 */
const cleanupOldDiensts = async () => {
  try {
    const nextMondayStart = getNextMondayStart();
    const nextMondayStartUTC = nextMondayStart.toUTC();

    const rawIds = await Dienst.distinct("companyId");
    const companyIds = rawIds.filter(
      (id): id is mongoose.Types.ObjectId => id != null,
    );

    if (!companyIds.length) {
      console.log("🧹 No hay Diensts con companyId para limpiar.");
      return;
    }

    let totalDeleted = 0;
    for (const companyId of companyIds) {
      const deleted = await cleanupOldDienstsForCompany(
        companyId,
        nextMondayStart,
        nextMondayStartUTC,
      );
      totalDeleted += deleted;
    }

    console.log(
      `🧹 Diensts eliminados: ${totalDeleted} (empresas: ${companyIds.length}; umbral próximo lunes 00:00 ${nextMondayStart.toISO()} / UTC ${nextMondayStartUTC.toISO()})`,
    );
  } catch (error) {
    console.error("❌ Error al eliminar Diensts antiguos:", error);
  }
};

export default cleanupOldDiensts;
