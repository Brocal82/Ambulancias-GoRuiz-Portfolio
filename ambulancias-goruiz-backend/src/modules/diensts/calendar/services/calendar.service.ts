import mongoose from "mongoose";
import Dienst from "../../models/dienst.model";
import { buildDienstSearchQuery } from "../../utils/dienstQueryBuilder";
import type { z } from "zod";
import type { dienstQuerySchema } from "../../schemas/dienstQuerySchema";

type DienstQueryParams = z.infer<typeof dienstQuerySchema>;

function companyFilter(companyId?: string | null): Record<string, unknown> {
  if (companyId) return { companyId: new mongoose.Types.ObjectId(companyId) };
  if (companyId === null || companyId === undefined) {
    return { $or: [{ companyId: null }, { companyId: { $exists: false } }] };
  }
  return {};
}

export async function getAllDiensts(companyId?: string | null) {
  const filter = companyFilter(companyId);
  return Dienst.find(filter)
    .populate("assignments.driver", "name lastName pscheinExpiry ambulanceRole")
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

export async function getDienstById(id: string) {
  return Dienst.findById(id).populate(
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
