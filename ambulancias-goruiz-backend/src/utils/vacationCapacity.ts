// backend/src/utils/vacationCapacity.ts
import { startOfDay, addDays } from 'date-fns';
import { Model, Types } from 'mongoose';

interface VacationDoc {
  _id: Types.ObjectId;
  startDate: Date | string;
  endDate: Date | string;
  status: 'pending' | 'accepted' | 'cancelled' | 'option_sent';
}

export async function findOverCapacityDays(
  VacationModel: Model<any>,               
  startISO: string | Date,                 
  endISO: string | Date,                   
  maxPerDay: number,
  excludingId?: string
): Promise<string[]> {
  const start = startOfDay(new Date(startISO));
  const end = startOfDay(new Date(endISO));

  const over: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dayStart = startOfDay(d);
    const dayEnd = addDays(dayStart, 1);

    // Cuenta solicitudes ACEPTADAS que solapen ese día
    const query: any = {
      status: 'accepted',
      startDate: { $lt: dayEnd }, // empieza antes del fin del día
      endDate: { $gte: dayStart }, // termina después (o en) el inicio del día
    };
    if (excludingId) query._id = { $ne: new Types.ObjectId(excludingId) };

    const count = await VacationModel.countDocuments(query).exec();
    if (count >= maxPerDay) {
      over.push(dayStart.toISOString());
    }
  }
  return over;
}
