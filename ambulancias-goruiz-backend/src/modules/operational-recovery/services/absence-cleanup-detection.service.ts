/**
 * Phase 2.1 — Absence Cleanup Detection Service.
 *
 * Scans one company for stale Dienst assignments caused by accepted
 * Vacation or Sick Leave.  Read-only: no mutations, no events, no websockets.
 *
 * Multi-tenant: every query is scoped by companyId.
 */

import mongoose from "mongoose";
import { DateTime } from "luxon";
import { Dienst } from "../../diensts";
import User from "../../users/models/user.model";
import VacationRequest from "../../vacation/models/vacation-request.model";
import SickLeave from "../../sick-leaves/models/sick-leave.model";
import type {
  AbsenceInconsistency,
  AbsenceType,
  DetectAbsenceInconsistenciesInput,
} from "../types/absence-cleanup.types";

const ZONE = "Europe/Berlin";

/** Generates all YYYY-MM-DD strings in [start, end], clamped to the optional window. */
function buildDatesInWindow(
  startDate: Date,
  endDate: Date,
  clampFrom: DateTime | undefined,
  clampTo: DateTime | undefined,
): string[] {
  let lo = DateTime.fromJSDate(startDate, { zone: ZONE }).startOf("day");
  let hi = DateTime.fromJSDate(endDate, { zone: ZONE }).startOf("day");

  if (clampFrom && lo < clampFrom) lo = clampFrom;
  if (clampTo && hi > clampTo) hi = clampTo;

  if (hi < lo) return [];

  const dates: string[] = [];
  for (let cur = lo; cur <= hi; cur = cur.plus({ days: 1 })) {
    const iso = cur.toISODate();
    if (iso) dates.push(iso);
  }
  return dates;
}

type InternalAbsenceEntry = {
  absenceType: AbsenceType;
  absenceId: string;
  /** Original full absence range (not clamped) for reporting. */
  absenceStartDate: string;
  absenceEndDate: string;
};

/**
 * Detects workers still assigned as Driver or Medic in a Dienst
 * while they have an accepted Vacation or accepted Sick Leave.
 *
 * Returns only operational information — no PII, no mutation.
 */
export async function detectAbsenceInconsistencies(
  input: DetectAbsenceInconsistenciesInput,
): Promise<AbsenceInconsistency[]> {
  const { companyId } = input;

  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    return [];
  }

  const companyOid = new mongoose.Types.ObjectId(companyId);

  const clampFrom = input.fromDate
    ? DateTime.fromISO(input.fromDate, { zone: ZONE }).startOf("day")
    : undefined;
  const clampTo = input.toDate
    ? DateTime.fromISO(input.toDate, { zone: ZONE }).startOf("day")
    : undefined;

  // ── 1. Resolve company members (tenant scope) ──────────────────────────────
  const members = await User.find({ companyId: companyOid })
    .select("_id name lastName")
    .lean();

  if (members.length === 0) return [];

  const memberIds = members.map((m) => m._id);
  const memberNameMap = new Map<string, string>(
    members.map((m) => {
      const name = ((m as Record<string, unknown>).name as string | undefined ?? "").trim();
      const lastName = ((m as Record<string, unknown>).lastName as string | undefined ?? "").trim();
      const display = [name, lastName].filter(Boolean).join(" ");
      return [String(m._id), display || String(m._id)];
    }),
  );

  // ── 2. Build absence date filter (only query absences that overlap the window) ─
  const absenceDateFilter: Record<string, unknown> = {};
  if (clampFrom) {
    absenceDateFilter.endDate = { $gte: clampFrom.toJSDate() };
  }
  if (clampTo) {
    absenceDateFilter.startDate = { $lte: clampTo.endOf("day").toJSDate() };
  }

  // ── 3. Fetch accepted absences scoped to company members ──────────────────
  const [vacations, sickLeaves] = await Promise.all([
    VacationRequest.find({
      user: { $in: memberIds },
      status: "accepted",
      ...absenceDateFilter,
    })
      .select("_id user startDate endDate")
      .lean(),
    SickLeave.find({
      user: { $in: memberIds },
      status: "accepted",
      ...absenceDateFilter,
    })
      .select("_id user startDate endDate")
      .lean(),
  ]);

  // ── 4. Build per-user, per-date absence index ──────────────────────────────
  // Map<userId, Map<dateISO, InternalAbsenceEntry>>
  const userDateMap = new Map<string, Map<string, InternalAbsenceEntry>>();

  function registerAbsence(
    userId: string,
    absenceType: AbsenceType,
    absenceId: string,
    startDate: Date,
    endDate: Date,
  ): void {
    const fullStartISO = DateTime.fromJSDate(startDate, { zone: ZONE })
      .startOf("day")
      .toISODate()!;
    const fullEndISO = DateTime.fromJSDate(endDate, { zone: ZONE })
      .startOf("day")
      .toISODate()!;

    const windowDates = buildDatesInWindow(startDate, endDate, clampFrom, clampTo);
    if (windowDates.length === 0) return;

    if (!userDateMap.has(userId)) {
      userDateMap.set(userId, new Map());
    }
    const dateIndex = userDateMap.get(userId)!;

    const entry: InternalAbsenceEntry = {
      absenceType,
      absenceId,
      absenceStartDate: fullStartISO,
      absenceEndDate: fullEndISO,
    };

    for (const date of windowDates) {
      // First registered absence wins per (user, date) — absences should not overlap.
      if (!dateIndex.has(date)) {
        dateIndex.set(date, entry);
      }
    }
  }

  for (const v of vacations) {
    registerAbsence(
      String(v.user),
      "vacation",
      String(v._id),
      v.startDate as Date,
      v.endDate as Date,
    );
  }
  for (const s of sickLeaves) {
    registerAbsence(
      String(s.user),
      "sick",
      String(s._id),
      s.startDate as Date,
      s.endDate as Date,
    );
  }

  if (userDateMap.size === 0) return [];

  // ── 5. Collect all affected dates for Dienst query ─────────────────────────
  const allAffectedDates = new Set<string>();
  for (const dateIndex of userDateMap.values()) {
    for (const date of dateIndex.keys()) {
      allAffectedDates.add(date);
    }
  }
  if (allAffectedDates.size === 0) return [];

  // ── 6. Fetch Diensts (scoped to company) on affected dates ─────────────────
  const dienste = await Dienst.find({
    companyId: companyOid,
    "assignments.date": { $in: [...allAffectedDates] },
  })
    .select("_id dienstNumber assignments")
    .lean();

  // ── 7. Cross-reference assignments against absence index ──────────────────
  const inconsistencies: AbsenceInconsistency[] = [];

  for (const dienst of dienste) {
    const dienstId = String(dienst._id);
    const dienstNumber = (dienst as Record<string, unknown>).dienstNumber as
      | number
      | undefined;
    const assignments = (
      (dienst as Record<string, unknown>).assignments as Array<Record<string, unknown>>
    ) ?? [];

    for (const assignment of assignments) {
      const dateISO = assignment.date as string | undefined;
      if (!dateISO || !allAffectedDates.has(dateISO)) continue;

      const rolesToCheck: Array<{ role: "driver" | "medic"; rawId: unknown }> = [
        { role: "driver", rawId: assignment.driver },
        { role: "medic", rawId: assignment.medic },
      ];

      for (const { role, rawId } of rolesToCheck) {
        if (rawId == null) continue;
        const userId = String(rawId);
        if (!mongoose.Types.ObjectId.isValid(userId)) continue;

        const dateIndex = userDateMap.get(userId);
        if (!dateIndex) continue;

        const entry = dateIndex.get(dateISO);
        if (!entry) continue;

        inconsistencies.push({
          workerId: userId,
          workerName: memberNameMap.get(userId) ?? userId,
          absenceType: entry.absenceType,
          absenceId: entry.absenceId,
          absenceStartDate: entry.absenceStartDate,
          absenceEndDate: entry.absenceEndDate,
          dienstId,
          dienstNumber,
          assignmentRole: role,
          assignmentDate: dateISO,
        });
      }
    }
  }

  return inconsistencies;
}
