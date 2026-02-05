// frontend/src/modules/diensts/utils/dayCellLines.ts
import { formatCellDateUnified } from "../../../utils/timeUtils";
import { formatAmbulanceLabel, formatPersonLabel } from "./display";

/**
 * Shape mínimo compatible con lo que ya usas en Worker/AdminUser.
 * (No añadimos campos nuevos, solo formalizamos el contrato.)
 */
export type DayCellLines = {
  dateLine: string;
  timeLine?: string;
  ambulanceLine: string;
  driverLine?: string;
  medicLine?: string;
};

type BuildArgs = {
  isoDay: string;
  lang: string;
  freeLabel: string; // ya viene con el emoji incluido (🌴 ...)
  assignment?: {
    startTime?: string;
    endTime?: string;
    ambulanceNumber?: unknown;
    ambulanceId?: unknown;
    driver?: unknown;
    medic?: unknown;
  } | null;
};

/**
 * Construye las lines para DienstDayCell con la misma UI y reglas actuales:
 * - dateLine: formatCellDateUnified(isoDay, lang)
 * - si NO hay assignment => día libre (solo ambulanceLine con freeLabel)
 * - si hay assignment => timeLine, ambulanceLine, driverLine, medicLine
 *
 * ⚠️ Importante:
 * - NO decide disabled
 * - NO aplica P-Schein (AdminDienstsPage lo mantiene inline)
 * - NO cambia ningún texto/emoji existente
 */
export function buildDienstDayCellLines({
  isoDay,
  lang,
  freeLabel,
  assignment,
}: BuildArgs): DayCellLines {
  const dateLine = formatCellDateUnified(isoDay, lang);

  if (!assignment) {
    return {
      dateLine,
      ambulanceLine: freeLabel,
    };
  }

  const timeLine = `🕒 ${assignment.startTime ?? ""} - ${assignment.endTime ?? ""}`;

  // Worker pasa ambulanceNumber; AdminUser a veces tiene ambulanceId poblado
  const rawAmbulance =
    assignment.ambulanceNumber ?? assignment.ambulanceId ?? "—";

  const ambulanceLine = `🚑 ${formatAmbulanceLabel(rawAmbulance)}`;

  const driverLine = `👨‍✈️ ${formatPersonLabel(assignment.driver)}`;
  const medicLine = `🧑‍⚕️ ${formatPersonLabel(assignment.medic)}`;

  return {
    dateLine,
    timeLine,
    ambulanceLine,
    driverLine,
    medicLine,
  };
}
