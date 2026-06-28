/**
 * Phase 2.3 — Absence Cleanup Monitor: frontend API calls.
 */
import axios from "../../../api/axios";

export type AbsenceType = "vacation" | "sick";

export interface AbsenceInconsistency {
  workerId: string;
  workerName: string;
  absenceType: AbsenceType;
  absenceId: string;
  absenceStartDate: string;
  absenceEndDate: string;
  dienstId: string;
  dienstNumber?: number;
  assignmentRole: "driver" | "medic";
  assignmentDate: string;
}

export interface RepairResult {
  assignmentsTouched: number;
  dienstsTouched: number;
  alreadyClean: boolean;
  repairFailed: boolean;
  errorMessage?: string;
  remainingInconsistencies: AbsenceInconsistency[];
}

export interface ScanResponse {
  inconsistencies: AbsenceInconsistency[];
  scannedAt: string;
}

export interface RepairItem {
  workerId: string;
  absenceType: AbsenceType;
  absenceId: string;
}

export interface RepairResponse {
  results: RepairResult[];
}

export async function scanAbsenceInconsistencies(
  token: string,
  opts?: { fromDate?: string; toDate?: string },
): Promise<ScanResponse> {
  const params: Record<string, string> = {};
  if (opts?.fromDate) params.fromDate = opts.fromDate;
  if (opts?.toDate) params.toDate = opts.toDate;

  const res = await axios.get<ScanResponse>(
    "/operational-recovery/absence-cleanup",
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );
  return res.data;
}

export async function repairAbsenceInconsistencies(
  token: string,
  items: RepairItem[],
): Promise<RepairResponse> {
  const res = await axios.post<RepairResponse>(
    "/operational-recovery/absence-cleanup/repair",
    { items },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}
