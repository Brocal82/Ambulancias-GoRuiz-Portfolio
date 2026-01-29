// frontend/src/types/dienst.ts
import type { Ambulance } from "./ambulance";

export interface UserRef {
  _id: string;
  name: string;
  lastName: string;
  ambulanceRole?: "driver" | "medic" | "both";
  pscheinExpiry?: string;
}

export interface DienstAssignment {
  _id: string;
  date: string;
  ambulanceId?: string | Ambulance;
  ambulanceNumber?: string;
  startTime: string;
  endTime: string;
  driver: string | UserRef;
  medic: string | UserRef;
}

export interface Dienst {
  _id: string;
  dienstNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  assignments: DienstAssignment[];
}

export interface UpdateAssignment {
  _id?: string;
  date: string;
  startTime: string;
  endTime: string;
  ambulanceId?: string | null;
  driver: string;
  medic: string;
}

export interface AssignedDay {
  dienstId: string;
  dienstNumber: number;
  assignmentId: string;
  date: string;
  startTime: string;
  endTime: string;

  // ✅ a veces viene string, a veces viene poblado como objeto
  ambulanceId?: string | Ambulance;
  ambulanceNumber?: string;

  // ✅ driver/medic pueden venir string, objeto o incluso undefined
  driver?: string | UserRef;
  medic?: string | UserRef;
}


export interface AssignedDayFull {
  dienstId: string;
  dienstNumber: number;
  assignmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  ambulanceId?: string | Ambulance;
  ambulanceNumber?: string;
  driver: UserRef;
  medic: UserRef;
}

// 🗓️ Horario por día de la semana para una plantilla
export interface DaySchedule {
  /**
   * 0 = domingo, 1 = lunes, ... 6 = sábado
   */
  dayIndex: number;
  /**
   * Hora de inicio "HH:mm".
   * Opcional para días libres.
   */
  startTime?: string;
  /**
   * Hora de fin "HH:mm".
   * Opcional para días libres.
   */
  endTime?: string;
  /**
   * true = día libre (no se genera assignment para ese día).
   */
  isOff: boolean;
}

// 📌 Plantilla de Dienst (base para generar Diensts reales por semana)
export interface DienstTemplate {
  _id: string;
  dienstNumber: number;
  startTime: string; // "HH:mm" (horario global por defecto)
  endTime: string; // "HH:mm"
  daysOff: number[]; // 0=domingo, ..., 6=sábado
  isActive: boolean;

  /**
   * Horario específico por día.
   * Si está definido y tiene elementos, el backend lo usará
   * para generar los Diensts con horarios distintos por día.
   * Si no existe o está vacío, se usará startTime/endTime/daysOff.
   */
  perDaySchedule?: DaySchedule[];
}
