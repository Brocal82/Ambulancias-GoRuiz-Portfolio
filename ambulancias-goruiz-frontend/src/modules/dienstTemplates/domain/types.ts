// src/modules/dienstTemplates/domain/types.ts

// 🗓️ Horario por día de la semana para una plantilla
export interface DaySchedule {
  dayIndex: number; // 0=domingo...6=sábado
  startTime?: string;
  endTime?: string;
  isOff: boolean;
}

// 📌 Plantilla de Dienst
export interface DienstTemplate {
  _id: string;
  dienstNumber: number;
  startTime: string;
  endTime: string;
  daysOff: number[];
  isActive: boolean;
  perDaySchedule?: DaySchedule[];
}