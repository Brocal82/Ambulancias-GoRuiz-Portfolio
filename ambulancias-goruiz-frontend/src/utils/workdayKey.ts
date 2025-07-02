//src/utils/workdayKey.ts

// 🔒 Cierre del día (por usuario)
export const closedKey = (assignmentId: string, userId: string) =>
  `workdayClosed-${assignmentId}-${userId}`;

// 🚐 Datos de ambulancia (compartidos por equipo)
export const ambulanceDataKey = (assignmentId: string) =>
  `ambulanceData-${assignmentId}`;

export const saveAmbulanceData = (
  assignmentId: string,
  vehicleNumber: string,
  initialKm: string
) => {
  localStorage.setItem(
    ambulanceDataKey(assignmentId),
    JSON.stringify({ vehicleNumber, initialKm })
  );
};

export const loadAmbulanceData = (
  assignmentId: string
): { vehicleNumber: string; initialKm: string } | null => {
  const raw = localStorage.getItem(ambulanceDataKey(assignmentId));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const confirmedAmbulanceKey = (assignmentId: string) =>
  `ambulanceConfirmed-${assignmentId}`;


export const clearAmbulanceData = (assignmentId: string) => {
  localStorage.removeItem(ambulanceDataKey(assignmentId));
};
