import type { AssignedDay } from "../types/dienst.types";

/**
 * Extrae fechas únicas (YYYY-MM-DD) de assignments que tienen date, startTime y endTime.
 */
export function extractValidDatesFromAssignments(
  assignments: Array<{ date?: unknown; startTime?: unknown; endTime?: unknown }> | null | undefined,
): string[] {
  const list = assignments ?? [];
  return Array.from(
    new Set(
      list
        .filter((a) => a?.date && a?.startTime && a?.endTime)
        .map((a) => a.date as string),
    ),
  );
}

/**
 * Convierte un assignment poblado + dienst en AssignedDay si el usuario
 * coincide como driver o medic. Si no coincide, retorna null.
 */
export function mapAssignmentToAssignedDay(
  assignment: any,
  dienst: { _id: any; dienstNumber: number },
  userId: string,
): AssignedDay | null {
  const driverId =
    assignment?.driver?._id?.toString?.() ?? assignment?.driver?.toString?.();
  const medicId =
    assignment?.medic?._id?.toString?.() ?? assignment?.medic?.toString?.();
  const isDriver = driverId === userId;
  const isMedic = medicId === userId;
  if (!isDriver && !isMedic) return null;

  const ambulanceData = assignment?.ambulanceId ?? null;
  const ambulanceId =
    ambulanceData && typeof ambulanceData === "object"
      ? ambulanceData._id?.toString?.()
      : typeof ambulanceData === "string"
        ? ambulanceData
        : undefined;
  const ambulanceNumber =
    ambulanceData && typeof ambulanceData === "object"
      ? ambulanceData.ambulanceNumber
      : undefined;

  return {
    dienstId: dienst._id.toString(),
    dienstNumber: dienst.dienstNumber,
    assignmentId: assignment?._id?.toString() ?? "",
    date: assignment?.date ?? "",
    startTime: assignment?.startTime ?? "",
    endTime: assignment?.endTime ?? "",
    ambulanceId,
    ambulanceNumber,
    driver: assignment?.driver?._id
      ? {
          _id: assignment.driver._id.toString(),
          name: assignment.driver.name,
          lastName: assignment.driver.lastName,
          pscheinExpiry: assignment.driver.pscheinExpiry,
        }
      : assignment?.driver || null,
    medic: assignment?.medic?._id
      ? {
          _id: assignment.medic._id.toString(),
          name: assignment.medic.name,
          lastName: assignment.medic.lastName,
          pscheinExpiry: assignment.medic.pscheinExpiry,
        }
      : assignment?.medic || null,
  };
}
