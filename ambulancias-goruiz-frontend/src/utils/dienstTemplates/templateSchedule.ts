// frontend/src/utils/dienstTemplates/templateSchedule.ts
import type { DienstTemplate, DaySchedule } from "../../modules/diensts/domain/types";

/**
 * Labels en español tal como los usas hoy.
 * Índices: 0=Dom ... 6=Sáb
 */
export const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

/**
 * Orden visual: Lunes (1) → Sábado (6) → Domingo (0)
 */
export const ORDERED_DAY_INDICES = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * View-model estable para el grid (igual que en tus modales).
 * Nota: startTime/endTime son obligatorios aquí, aunque en DaySchedule sean opcionales.
 */
export interface DayScheduleFormRow {
  dayIndex: number;
  isOff: boolean;
  startTime: string;
  endTime: string;
}

/**
 * Devuelve el estado inicial del grid para el Create (mismo comportamiento que hoy).
 */
export const buildDefaultPerDayRows = (
  startTime = "06:00",
  endTime = "14:00",
): DayScheduleFormRow[] => {
  return DAY_LABELS.map((_, dayIndex) => ({
    dayIndex,
    isOff: false,
    startTime,
    endTime,
  }));
};

/**
 * Construye las filas iniciales del grid para el Edit a partir del template,
 * replicando EXACTAMENTE tu lógica actual:
 * - usa baseStart/baseEnd del template (o fallback)
 * - respeta daysOff
 * - si perDaySchedule existe y tiene elementos, lo prioriza por dayIndex
 */
export const buildInitialPerDaySchedule = (
  tpl: DienstTemplate,
): DayScheduleFormRow[] => {
  const baseStart = tpl.startTime || "06:00";
  const baseEnd = tpl.endTime || "14:00";
  const daysOffSet = new Set<number>(tpl.daysOff ?? []);

  if (tpl.perDaySchedule && tpl.perDaySchedule.length > 0) {
    return DAY_LABELS.map((_, dayIndex) => {
      const cfg = tpl.perDaySchedule!.find((d) => d.dayIndex === dayIndex);

      if (cfg) {
        return {
          dayIndex,
          isOff: !!cfg.isOff,
          startTime: cfg.startTime || baseStart,
          endTime: cfg.endTime || baseEnd,
        };
      }

      return {
        dayIndex,
        isOff: daysOffSet.has(dayIndex),
        startTime: baseStart,
        endTime: baseEnd,
      };
    });
  }

  return DAY_LABELS.map((_, dayIndex) => ({
    dayIndex,
    isOff: daysOffSet.has(dayIndex),
    startTime: baseStart,
    endTime: baseEnd,
  }));
};

export const areAllDaysOff = (rows: DayScheduleFormRow[]): boolean =>
  rows.every((d) => d.isOff);

export const buildDaysOff = (rows: DayScheduleFormRow[]): number[] =>
  rows.filter((d) => d.isOff).map((d) => d.dayIndex);

/**
 * Convierte las filas del grid a DaySchedule[] para API (mapeo 1:1).
 */
export const buildPerDayScheduleForApi = (
  rows: DayScheduleFormRow[],
): DaySchedule[] =>
  rows.map((d) => ({
    dayIndex: d.dayIndex,
    isOff: d.isOff,
    startTime: d.startTime,
    endTime: d.endTime,
  }));

/**
 * Reproduce tu lógica actual:
 * - globalStart/globalEnd salen del primer día laborable
 * - fallback a startFallback/endFallback o defaults
 */
export const buildGlobalStartEndFromWorkingDays = (
  rows: DayScheduleFormRow[],
  startFallback?: string,
  endFallback?: string,
): { globalStart: string; globalEnd: string } => {
  const workingDays = rows.filter((d) => !d.isOff);
  const globalStart = workingDays[0]?.startTime || startFallback || "06:00";
  const globalEnd = workingDays[0]?.endTime || endFallback || "14:00";
  return { globalStart, globalEnd };
};

export const buildDienstTemplateInputFromRows = (params: {
  dienstNumber: number;
  isActive: boolean;
  rows: DayScheduleFormRow[];
  startFallback?: string;
  endFallback?: string;
}): {
  startTime: string;
  endTime: string;
  daysOff: number[];
  isActive: boolean;
  perDaySchedule: DaySchedule[];
  dienstNumber: number;
} => {
  const { dienstNumber, isActive, rows, startFallback, endFallback } = params;

  const daysOff = buildDaysOff(rows);

  const { globalStart, globalEnd } = buildGlobalStartEndFromWorkingDays(
    rows,
    startFallback,
    endFallback,
  );

  const perDaySchedule = buildPerDayScheduleForApi(rows);

  return {
    dienstNumber,
    startTime: globalStart,
    endTime: globalEnd,
    daysOff,
    isActive,
    perDaySchedule,
  };
};

