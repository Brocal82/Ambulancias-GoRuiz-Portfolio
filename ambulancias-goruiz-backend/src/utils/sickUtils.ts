import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import SickLeave from '../models/SickLeave';

const ZONE = 'Europe/Berlin';

/**
 * Devuelve true si el usuario tiene una baja ACEPTADA que cubre el día dateISO (YYYY-MM-DD),
 * calculado en TZ Europe/Berlin para evitar off-by-one/DST.
 */
export async function isOnSickDay(params: {
  userId: string;
  dateISO: string; // 'YYYY-MM-DD'
}): Promise<boolean> {
  const { userId, dateISO } = params;

  if (!mongoose.Types.ObjectId.isValid(userId)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;

  const startBER = DateTime.fromISO(dateISO, { zone: ZONE }).startOf('day');
  const endBER = DateTime.fromISO(dateISO, { zone: ZONE }).endOf('day');

  const count = await SickLeave.countDocuments({
    user: new mongoose.Types.ObjectId(userId),
    status: 'accepted',
    startDate: { $lte: endBER.toJSDate() },
    endDate: { $gte: startBER.toJSDate() },
  });

  return count > 0;
}

/**
 * (Opcional) Devuelve la baja que se solapa con una fecha concreta (cualquier estado, por defecto).
 * Útil para decoraciones UI tipo "Enfermo hasta {{fecha}}".
 */
export async function findOverlappingSickLeave(params: {
  userId: string;
  dateISO: string;
  statuses?: Array<'pending' | 'accepted' | 'rejected'>;
}) {
  const { userId, dateISO, statuses } = params;

  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;

  const startBER = DateTime.fromISO(dateISO, { zone: ZONE }).startOf('day');
  const endBER = DateTime.fromISO(dateISO, { zone: ZONE }).endOf('day');

  const query: any = {
    user: new mongoose.Types.ObjectId(userId),
    startDate: { $lte: endBER.toJSDate() },
    endDate: { $gte: startBER.toJSDate() },
  };
  if (Array.isArray(statuses) && statuses.length > 0) {
    query.status = { $in: statuses };
  }

  return SickLeave.findOne(query).lean();
}
