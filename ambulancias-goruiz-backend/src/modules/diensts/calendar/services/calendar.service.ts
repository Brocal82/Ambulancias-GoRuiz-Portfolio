import mongoose from "mongoose";
import Dienst from "../../models/dienst.model";
import { buildDienstSearchQuery } from "../../utils/dienstQueryBuilder";
import type { z } from "zod";
import type { dienstQuerySchema } from "../../schemas/dienstQuerySchema";

type DienstQueryParams = z.infer<typeof dienstQuerySchema>;

function companyFilter(companyId?: string | null): Record<string, unknown> {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return { _id: { $in: [] } };
  }
  return { companyId: new mongoose.Types.ObjectId(raw) };
}

export async function getAllDiensts(companyId?: string | null) {
  const filter = companyFilter(companyId);
  return Dienst.find(filter)
    .populate(
      "assignments.driver",
      "name lastName pscheinExpiry ambulanceRole pscheinConfirmedAt",
    )
    .populate("assignments.medic", "name lastName pscheinExpiry ambulanceRole")
    .populate("assignments.ambulanceId", "ambulanceNumber brand modelName licensePlate")
    .lean();
}

/**
 * Lista todos los Diensts con populate básico (driver/medic).
 * Usado por GET /api/users/diensts para mantener contrato de respuesta.
 */
export async function getAllDienstsWithBasicPopulate(companyId?: string | null) {
  const filter = companyFilter(companyId);
  return Dienst.find(filter).populate(
    "assignments.driver assignments.medic",
  );
}

/**
 * Carga un Dienst por id acotado a la empresa. No devuelve filas con `companyId` null
 * ni de otro tenant.
 */
export async function getDienstById(id: string, companyId?: string | null) {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return null;
  }
  return Dienst.findOne({
    _id: new mongoose.Types.ObjectId(id),
    companyId: new mongoose.Types.ObjectId(raw),
  }).populate(
    "assignments.driver assignments.medic assignments.ambulanceId",
  );
}

export async function searchDienst(queryParams: DienstQueryParams, companyId?: string | null) {
  const query = { ...buildDienstSearchQuery(queryParams), ...companyFilter(companyId) };
  return Dienst.find(query).populate(
    "assignments.driver assignments.medic",
  );
}

export async function getDienstsByUser(userId: string, userCompanyId?: string | null) {
  const baseFilter: Record<string, unknown> = {
    assignments: {
      $elemMatch: {
        $or: [
          { driver: new mongoose.Types.ObjectId(userId) },
          { medic: new mongoose.Types.ObjectId(userId) },
        ],
      },
    },
  };
  Object.assign(baseFilter, companyFilter(userCompanyId));
  return Dienst.find(baseFilter)
    .populate("assignments.driver", "name lastName")
    .populate("assignments.medic", "name lastName");
}
