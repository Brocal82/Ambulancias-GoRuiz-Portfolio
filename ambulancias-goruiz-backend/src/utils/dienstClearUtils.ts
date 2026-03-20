// backend/src/utils/dienstClearUtils.ts
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { Dienst } from "../modules/diensts";

const ZONE = "Europe/Berlin";

/**
 * Desasigna a un usuario (driver/medic) de TODOS los Diensts
 * en el rango [startISO..endISO], sin tocar horas ni ambulancia
 * ni al compañero.
 *
 * - userId: ObjectId del usuario
 * - startISO / endISO: 'YYYY-MM-DD' (inclusive, en zona Europe/Berlin)
 *
 * Devuelve estadísticas útiles para logs.
 */
export async function clearUserFromDienstsInRange(params: {
  userId: string;
  startISO: string; // 'YYYY-MM-DD'
  endISO: string; // 'YYYY-MM-DD'
}): Promise<{
  diensteTouched: number;
  assignmentsTouched: number;
  range: { startISO: string; endISO: string };
}> {
  const { userId, startISO, endISO } = params;

  // Validaciones básicas
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return {
      diensteTouched: 0,
      assignmentsTouched: 0,
      range: { startISO, endISO },
    };
  }

  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(startISO) || !isoRegex.test(endISO)) {
    return {
      diensteTouched: 0,
      assignmentsTouched: 0,
      range: { startISO, endISO },
    };
  }

  // Normalizamos el rango en TZ Berlin [00:00..23:59]
  let startDt = DateTime.fromISO(startISO, { zone: ZONE }).startOf("day");
  let endDt = DateTime.fromISO(endISO, { zone: ZONE }).endOf("day");

  if (!startDt.isValid || !endDt.isValid || endDt < startDt) {
    return {
      diensteTouched: 0,
      assignmentsTouched: 0,
      range: { startISO, endISO },
    };
  }

  // Construimos la lista de días ISO 'YYYY-MM-DD' del rango
  const daysISO: string[] = [];
  for (let d = startDt; d <= endDt; d = d.plus({ days: 1 })) {
    const iso = d.toISODate();
    if (iso) daysISO.push(iso);
  }

  if (daysISO.length === 0) {
    return {
      diensteTouched: 0,
      assignmentsTouched: 0,
      range: { startISO, endISO },
    };
  }

  // Buscar todos los Diensts que tengan assignments en cualquiera de esos días
  const dienste = await Dienst.find({
    "assignments.date": { $in: daysISO },
  });

  let diensteTouched = 0;
  let assignmentsTouched = 0;
  const userIdStr = String(userId);

  for (const d of dienste) {
    let changedDienst = false;

    d.assignments = (d.assignments || []).map((a: any) => {
      if (!a?.date || !a?.startTime || !a?.endTime) return a;
      if (!daysISO.includes(a.date)) return a;

      const drv = a?.driver ? String(a.driver) : undefined;
      const med = a?.medic ? String(a.medic) : undefined;

      let changed = false;
      const next: any = { ...a };

      if (drv && drv === userIdStr) {
        next.driver = undefined;
        changed = true;
      }
      if (med && med === userIdStr) {
        next.medic = undefined;
        changed = true;
      }

      if (changed) {
        assignmentsTouched += 1;
        changedDienst = true;
      }

      return next;
    });

    if (changedDienst) {
      await d.save();
      diensteTouched += 1;
    }
  }

  return {
    diensteTouched,
    assignmentsTouched,
    range: { startISO, endISO },
  };
}
