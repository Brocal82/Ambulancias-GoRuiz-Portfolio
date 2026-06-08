/**
 * Persist in-progress trip draft (incl. Anschluss) per assignment+date.
 * Survives app kill; cleared on successful save or workday closure.
 */
import {
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";

import type { CreateTripPayload } from "../services/workday";

const CACHE_SUBDIR = "workday-trip-draft";
const STORAGE_VERSION = 1 as const;

export type TripDraftPhase = "meta" | "steps";

export type StoredTripDraftSession = {
  version: typeof STORAGE_VERSION;
  assignmentId: string;
  date: string;
  phase: TripDraftPhase;
  currentStep: 1 | 2 | 3 | 4 | 5;
  draft: CreateTripPayload;
  kmDraft2: string;
  kmDraft4: string;
  pendingPatient1Anschluss: CreateTripPayload | null;
  anschlussAwaitingPatient2Step3: boolean;
  anschlussMinKmStart?: number;
  anschlussResumeStep: 1 | 2 | 3 | 4 | 5 | null;
};

function safeFileToken(value: string): string {
  return encodeURIComponent(value);
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

function draftFilePath(dir: string, assignmentId: string, date: string): string {
  return `${dir}draft-${safeFileToken(assignmentId)}-${safeFileToken(date)}.json`;
}

function isStep(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function isPhase(value: unknown): value is TripDraftPhase {
  return value === "meta" || value === "steps";
}

function isCreateTripPayload(value: unknown): value is CreateTripPayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.date === "string" &&
    typeof row.assignmentId === "string" &&
    typeof row.driver === "string" &&
    typeof row.medic === "string" &&
    typeof row.auftragNumber === "string" &&
    typeof row.patientName === "string" &&
    typeof row.fromAddress === "string" &&
    typeof row.toAddress === "string"
  );
}

function parseStoredSession(raw: unknown): StoredTripDraftSession | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.version !== STORAGE_VERSION) return null;
  if (typeof row.assignmentId !== "string" || typeof row.date !== "string") return null;
  if (!isPhase(row.phase) || !isStep(row.currentStep)) return null;
  if (!isCreateTripPayload(row.draft)) return null;
  if (typeof row.kmDraft2 !== "string" || typeof row.kmDraft4 !== "string") return null;
  if (typeof row.anschlussAwaitingPatient2Step3 !== "boolean") return null;
  if (row.pendingPatient1Anschluss != null && !isCreateTripPayload(row.pendingPatient1Anschluss)) {
    return null;
  }
  const resume = row.anschlussResumeStep;
  if (resume != null && !isStep(resume)) return null;
  const minKm = row.anschlussMinKmStart;
  if (minKm != null && (typeof minKm !== "number" || Number.isNaN(minKm))) return null;

  return {
    version: STORAGE_VERSION,
    assignmentId: row.assignmentId,
    date: row.date,
    phase: row.phase,
    currentStep: row.currentStep,
    draft: row.draft,
    kmDraft2: row.kmDraft2,
    kmDraft4: row.kmDraft4,
    pendingPatient1Anschluss: (row.pendingPatient1Anschluss as CreateTripPayload | null) ?? null,
    anschlussAwaitingPatient2Step3: row.anschlussAwaitingPatient2Step3,
    ...(minKm != null ? { anschlussMinKmStart: minKm } : {}),
    anschlussResumeStep: resume ?? null,
  };
}

export function draftHasUserInput(draft: CreateTripPayload): boolean {
  return (
    draft.auftragNumber.trim() !== "" ||
    draft.patientName.trim() !== "" ||
    draft.fromAddress.trim() !== "" ||
    draft.toAddress.trim() !== "" ||
    draft.timeWarning.trim() !== "" ||
    draft.timeAtHome.trim() !== "" ||
    draft.timePickup.trim() !== "" ||
    draft.timeArrival.trim() !== "" ||
    draft.timeEnd.trim() !== "" ||
    draft.kmStart !== 0 ||
    draft.kmEnd !== 0 ||
    (draft.reports ?? "").trim() !== "" ||
    draft.wasCancelled ||
    draft.cancelledAtPickup
  );
}

export function hasPersistableTripDraft(args: {
  phase: TripDraftPhase;
  draft: CreateTripPayload;
  kmDraft2: string;
  kmDraft4: string;
  pendingPatient1Anschluss: CreateTripPayload | null;
  anschlussAwaitingPatient2Step3: boolean;
}): boolean {
  if (args.phase === "steps") return true;
  if (args.anschlussAwaitingPatient2Step3 || args.pendingPatient1Anschluss) return true;
  if (args.kmDraft2.trim() !== "" || args.kmDraft4.trim() !== "") return true;
  return draftHasUserInput(args.draft);
}

export async function loadTripDraftSessionAsync(
  assignmentId: string,
  date: string,
): Promise<StoredTripDraftSession | null> {
  try {
    const dir = await ensureCacheDir();
    const path = draftFilePath(dir, assignmentId, date);
    const info = await getInfoAsync(path);
    if (!info.exists) return null;
    const raw = JSON.parse(await readAsStringAsync(path)) as unknown;
    const parsed = parseStoredSession(raw);
    if (!parsed) return null;
    if (parsed.assignmentId !== assignmentId || parsed.date !== date) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveTripDraftSessionAsync(
  assignmentId: string,
  date: string,
  session: StoredTripDraftSession,
): Promise<void> {
  if (session.assignmentId !== assignmentId || session.date !== date) return;
  if (
    !hasPersistableTripDraft({
      phase: session.phase,
      draft: session.draft,
      kmDraft2: session.kmDraft2,
      kmDraft4: session.kmDraft4,
      pendingPatient1Anschluss: session.pendingPatient1Anschluss,
      anschlussAwaitingPatient2Step3: session.anschlussAwaitingPatient2Step3,
    })
  ) {
    await clearTripDraftSessionAsync(assignmentId, date);
    return;
  }
  const dir = await ensureCacheDir();
  const path = draftFilePath(dir, assignmentId, date);
  await writeAsStringAsync(path, JSON.stringify(session));
}

export async function clearTripDraftSessionAsync(
  assignmentId: string,
  date: string,
): Promise<void> {
  try {
    const dir = await ensureCacheDir();
    const path = draftFilePath(dir, assignmentId, date);
    const info = await getInfoAsync(path);
    if (info.exists) {
      await deleteAsync(path, { idempotent: true });
    }
  } catch {
    // ignore — local cache is best-effort
  }
}
