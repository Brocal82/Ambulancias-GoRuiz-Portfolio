import mongoose from "mongoose";
import { Dienst } from "../../diensts";
import { Team } from "../../teams/models/team.model";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";
import { TripSetup } from "../../trips/models/trip-setup.model";
import MechanicsIssue from "../../mechanics/models/mechanics-issue.model";
import MechanicsWorkOrder from "../../mechanics/models/mechanics-work-order.model";

export type AmbulanceReferenceSource =
  | "dienst-assignments"
  | "teams"
  | "workday-summary"
  | "mechanics-work-orders"
  | "mechanics-issues"
  | "trip-setup";

export type AmbulanceReferenceCheck = {
  inUse: boolean;
  sources: AmbulanceReferenceSource[];
};

function ambulanceIdMatchConditions(ambulanceId: string) {
  const oid = new mongoose.Types.ObjectId(ambulanceId);
  const idStr = ambulanceId;
  return { $or: [{ ambulanceId: oid }, { ambulanceId: idStr }] };
}

export async function findAmbulanceReferences(
  ambulanceId: string,
  companyId: string,
): Promise<AmbulanceReferenceCheck> {
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const ambulanceOid = new mongoose.Types.ObjectId(ambulanceId);
  const sources: AmbulanceReferenceSource[] = [];

  const dienstRef = await Dienst.exists({
    companyId: companyOid,
    "assignments.ambulanceId": ambulanceOid,
  }).lean();
  if (dienstRef) {
    sources.push("dienst-assignments");
  }

  const teamRef = await Team.exists({
    companyId: companyOid,
    ambulanceId: ambulanceOid,
  }).lean();
  if (teamRef) {
    sources.push("teams");
  }

  const summaryRef = await WorkdaySummary.exists({
    companyId: companyOid,
    ...ambulanceIdMatchConditions(ambulanceId),
  }).lean();
  if (summaryRef) {
    sources.push("workday-summary");
  }

  const workOrderRef = await MechanicsWorkOrder.exists({
    companyId: companyOid,
    ambulanceId: ambulanceOid,
  }).lean();
  if (workOrderRef) {
    sources.push("mechanics-work-orders");
  }

  const issueRef = await MechanicsIssue.exists({
    companyId: companyOid,
    ...ambulanceIdMatchConditions(ambulanceId),
  }).lean();
  if (issueRef) {
    sources.push("mechanics-issues");
  }

  const tripSetupRef = await TripSetup.exists({
    companyId: companyOid,
    ...ambulanceIdMatchConditions(ambulanceId),
  }).lean();
  if (tripSetupRef) {
    sources.push("trip-setup");
  }

  return {
    inUse: sources.length > 0,
    sources,
  };
}

export class AmbulanceInUseError extends Error {
  statusCode = 409;

  constructor(public sources: AmbulanceReferenceSource[]) {
    super(
      "No se puede eliminar la ambulancia porque está referenciada en turnos, equipos, jornadas u otros registros",
    );
    this.name = "AmbulanceInUseError";
  }
}
