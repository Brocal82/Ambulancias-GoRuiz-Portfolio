import mongoose from "mongoose";
import Dienst from "../../../../models/Dienst";
import { buildDienstSearchQuery } from "../../utils/dienstQueryBuilder";
import type { z } from "zod";
import type { dienstQuerySchema } from "../../schemas/dienstQuerySchema";

type DienstQueryParams = z.infer<typeof dienstQuerySchema>;

export async function getAllDiensts() {
  return Dienst.find()
    .populate("assignments.driver", "name lastName pscheinExpiry ambulanceRole")
    .populate("assignments.medic", "name lastName pscheinExpiry ambulanceRole")
    .populate("assignments.ambulanceId", "ambulanceNumber brand modelName licensePlate")
    .lean();
}

export async function getDienstById(id: string) {
  return Dienst.findById(id).populate(
    "assignments.driver assignments.medic assignments.ambulanceId",
  );
}

export async function searchDienst(queryParams: DienstQueryParams) {
  const query = buildDienstSearchQuery(queryParams);
  return Dienst.find(query).populate(
    "assignments.driver assignments.medic",
  );
}

export async function getDienstsByUser(userId: string) {
  return Dienst.find({
    assignments: {
      $elemMatch: {
        $or: [
          { driver: new mongoose.Types.ObjectId(userId) },
          { medic: new mongoose.Types.ObjectId(userId) },
        ],
      },
    },
  })
    .populate("assignments.driver", "name lastName")
    .populate("assignments.medic", "name lastName");
}
