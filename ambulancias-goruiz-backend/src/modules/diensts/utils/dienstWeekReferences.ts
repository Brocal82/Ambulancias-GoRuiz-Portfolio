import mongoose from "mongoose";
import { Trip } from "../../trips/models/trip.model";
import { TripSetup } from "../../trips/models/trip-setup.model";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";
import MechanicsIssue from "../../mechanics/models/mechanics-issue.model";

export type DienstWeekReferenceSource =
  | "trips"
  | "trip-setup"
  | "workday-summary"
  | "mechanics-issues";

export type DienstWeekReferenceCheck = {
  inUse: boolean;
  sources: DienstWeekReferenceSource[];
  counts: Partial<Record<DienstWeekReferenceSource, number>>;
};

export class DeleteWeekConflictError extends Error {
  statusCode = 409;

  constructor(
    public sources: DienstWeekReferenceSource[],
    public counts: Partial<Record<DienstWeekReferenceSource, number>>,
  ) {
    super(
      "No se puede eliminar la semana porque hay datos operativos vinculados (viajes, cierres de jornada u otros registros).",
    );
    this.name = "DeleteWeekConflictError";
  }
}

/**
 * Comprueba referencias downstream por assignmentId y por dienstNumber+fecha
 * antes de borrar una semana completa de Diensts.
 */
export async function findDienstWeekDownstreamReferences(params: {
  companyId: string;
  assignmentIds: mongoose.Types.ObjectId[];
  weekDateISOs: string[];
  dienstNumbers: number[];
}): Promise<DienstWeekReferenceCheck> {
  const { companyId, assignmentIds, weekDateISOs, dienstNumbers } = params;
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const sources: DienstWeekReferenceSource[] = [];
  const counts: Partial<Record<DienstWeekReferenceSource, number>> = {};

  if (assignmentIds.length === 0 && dienstNumbers.length === 0) {
    return { inUse: false, sources, counts };
  }

  if (assignmentIds.length > 0) {
    const tripCount = await Trip.countDocuments({
      companyId: companyOid,
      assignmentId: { $in: assignmentIds },
    });
    if (tripCount > 0) {
      sources.push("trips");
      counts.trips = tripCount;
    }

    const tripSetupCount = await TripSetup.countDocuments({
      companyId: companyOid,
      assignmentId: { $in: assignmentIds },
    });
    if (tripSetupCount > 0) {
      sources.push("trip-setup");
      counts["trip-setup"] = tripSetupCount;
    }

    const assignmentIdStrs = assignmentIds.map((id) => id.toString());
    const workdayCount = await WorkdaySummary.countDocuments({
      companyId: companyOid,
      assignmentId: { $in: assignmentIdStrs },
      date: { $in: weekDateISOs },
    });
    if (workdayCount > 0) {
      sources.push("workday-summary");
      counts["workday-summary"] = workdayCount;
    }
  }

  if (dienstNumbers.length > 0 && weekDateISOs.length > 0) {
    const mechanicsCount = await MechanicsIssue.countDocuments({
      companyId: companyOid,
      dienstNumber: { $in: dienstNumbers },
      date: { $in: weekDateISOs },
    });
    if (mechanicsCount > 0) {
      sources.push("mechanics-issues");
      counts["mechanics-issues"] = mechanicsCount;
    }
  }

  return {
    inUse: sources.length > 0,
    sources,
    counts,
  };
}
