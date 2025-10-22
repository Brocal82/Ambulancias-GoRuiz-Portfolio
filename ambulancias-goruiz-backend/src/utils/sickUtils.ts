// backend/src/utils/sickUtils.ts
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import SickLeave from '../models/SickLeave';

const ZONE = 'Europe/Berlin';

/**
 * Devuelve true si el usuario tiene una baja ACEPTADA que cubra el día indicado.
 * - dateISO en formato 'YYYY-MM-DD'
 * - Maneja TZ/DST en Europe/Berlin para evitar off-by-one.
 * - Solo cuenta bajas con status 'accepted'.
 */
export async function isOnSickDay(params: {
  userId: string;
  dateISO: string; // 'YYYY-MM-DD'
}): Promise<boolean> {
  const { userId, dateISO } = params;

  if (!mongoose.Types.ObjectId.isValid(userId)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;

  // Límites del día en Berlin
  const startBER = DateTime.fromISO(dateISO, { zone: ZONE }).startOf('day');
  const endBER   = DateTime.fromISO(dateISO, { zone: ZONE }).endOf('day');

  const count = await SickLeave.countDocuments({
    user: userId,
    status: 'accepted',
    startDate: { $lte: endBER.toJSDate() },
    endDate:   { $gte: startBER.toJSDate() },
  });

  return count > 0;
}

/**
 * (Opcional) Devuelve una baja aceptada que solape un día concreto, si existe.
 * Útil para obtener, p.ej., "enfermo hasta {{fecha}}".
 */
export async function findOverlappingSickLeave(params: {
  userId: string;
  dateISO: string;
}) {
  const { userId, dateISO } = params;

  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;

  const startBER = DateTime.fromISO(dateISO, { zone: ZONE }).startOf('day');
  const endBER   = DateTime.fromISO(dateISO, { zone: ZONE }).endOf('day');

  return SickLeave.findOne({
    user: userId,
    status: 'accepted',
    startDate: { $lte: endBER.toJSDate() },
    endDate:   { $gte: startBER.toJSDate() },
  })
    .select('_id startDate endDate status documentUrl requiresDocument verificationStatus documentDueAt')
    .lean();
}
