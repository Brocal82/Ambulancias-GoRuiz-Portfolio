import mongoose from "mongoose";
import { Trip } from "../../trips/models/trip.model";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";

export type HospitalReferenceSource = "trips" | "workday-summary";

export type HospitalReferenceCheck = {
  inUse: boolean;
  sources: HospitalReferenceSource[];
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildExactAddressOrConditions = (field: string, name: string, address: string) => {
  const candidates = [...new Set([name, address].map((v) => v.trim()).filter(Boolean))];
  return candidates.map((candidate) => ({
    [field]: { $regex: new RegExp(`^\\s*${escapeRegex(candidate)}\\s*$`, "i") },
  }));
};

/**
 * Diensts no almacenan hospitalId; trips y workday-summary guardan destino en toAddress (texto).
 */
export async function findHospitalReferences(
  hospital: { name: string; address: string },
  companyId: string,
): Promise<HospitalReferenceCheck> {
  const oid = new mongoose.Types.ObjectId(companyId);
  const sources: HospitalReferenceSource[] = [];

  const tripConditions = buildExactAddressOrConditions(
    "toAddress",
    hospital.name,
    hospital.address,
  );
  if (tripConditions.length > 0) {
    const tripRef = await Trip.exists({
      companyId: oid,
      $or: tripConditions,
    }).lean();
    if (tripRef) {
      sources.push("trips");
    }
  }

  const summaryConditions = buildExactAddressOrConditions(
    "trips.toAddress",
    hospital.name,
    hospital.address,
  );
  if (summaryConditions.length > 0) {
    const summaryRef = await WorkdaySummary.exists({
      companyId: oid,
      $or: summaryConditions,
    }).lean();
    if (summaryRef) {
      sources.push("workday-summary");
    }
  }

  return {
    inUse: sources.length > 0,
    sources,
  };
}

export class HospitalInUseError extends Error {
  statusCode = 409;

  constructor(public sources: HospitalReferenceSource[]) {
    super(
      "No se puede eliminar el hospital porque está referenciado en viajes o jornadas",
    );
    this.name = "HospitalInUseError";
  }
}
