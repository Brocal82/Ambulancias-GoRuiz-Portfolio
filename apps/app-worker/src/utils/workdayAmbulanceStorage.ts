/**
 * Misma convención que la web (`workdayKey.ts`): datos de ambulancia por asignación del día.
 * Persistencia en disco vía `expo-file-system/legacy` (sin AsyncStorage; evita paquete roto en monorepo).
 */
import {
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";

export type StoredAmbulanceData = {
  ambulanceId: string;
  ambulanceNumber: string;
  initialKm: string;
};

export function ambulanceDataKey(assignmentId: string): string {
  return `ambulanceData-${assignmentId}`;
}

export function confirmedAmbulanceKey(assignmentId: string): string {
  return `ambulanceConfirmed-${assignmentId}`;
}

const CACHE_SUBDIR = "workday-ambulance";

function safeFileToken(assignmentId: string): string {
  return encodeURIComponent(assignmentId);
}

async function cacheDir(): Promise<string> {
  const root = documentDirectory;
  if (!root) {
    throw new Error("documentDirectory no disponible (expo-file-system).");
  }
  return `${root}${CACHE_SUBDIR}/`;
}

async function ensureCacheDir(): Promise<string> {
  const dir = await cacheDir();
  const info = await getInfoAsync(dir);
  if (!info.exists) {
    await makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function dataFilePath(dir: string, assignmentId: string): string {
  return `${dir}data-${safeFileToken(assignmentId)}.json`;
}

function confirmedFilePath(dir: string, assignmentId: string): string {
  return `${dir}confirmed-${safeFileToken(assignmentId)}.txt`;
}

export async function loadAmbulanceDataAsync(
  assignmentId: string,
): Promise<StoredAmbulanceData | null> {
  try {
    const dir = await ensureCacheDir();
    const path = dataFilePath(dir, assignmentId);
    const info = await getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await readAsStringAsync(path);
    const parsed = JSON.parse(raw) as StoredAmbulanceData;
    if (
      parsed &&
      typeof parsed.ambulanceId === "string" &&
      typeof parsed.ambulanceNumber === "string" &&
      typeof parsed.initialKm === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveAmbulanceDataAsync(
  assignmentId: string,
  ambulanceId: string,
  ambulanceNumber: string,
  initialKm: string,
): Promise<void> {
  const dir = await ensureCacheDir();
  const path = dataFilePath(dir, assignmentId);
  await writeAsStringAsync(path, JSON.stringify({ ambulanceId, ambulanceNumber, initialKm }));
}

export async function getVehicleConfirmedAsync(assignmentId: string): Promise<boolean> {
  try {
    const dir = await ensureCacheDir();
    const path = confirmedFilePath(dir, assignmentId);
    const info = await getInfoAsync(path);
    if (!info.exists) return false;
    const v = (await readAsStringAsync(path)).trim();
    return v === "true";
  } catch {
    return false;
  }
}

export async function setVehicleConfirmedAsync(
  assignmentId: string,
  confirmed: boolean,
): Promise<void> {
  const dir = await ensureCacheDir();
  const path = confirmedFilePath(dir, assignmentId);
  if (confirmed) {
    await writeAsStringAsync(path, "true");
  } else {
    const info = await getInfoAsync(path);
    if (info.exists) {
      await deleteAsync(path, { idempotent: true });
    }
  }
}
