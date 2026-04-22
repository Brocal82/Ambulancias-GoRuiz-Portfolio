import mongoose from "mongoose";
import { Dienst } from "../../diensts";
import type { IDienst, IDienstAssignment } from "../../diensts";

/** Error con código HTTP para mapeo en controllers (cierre jornada / averías). */
export class WorkdaySummaryError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "WorkdaySummaryError";
  }
}

/** Resuelve el assignment por assignmentId dentro del tenant. Lanza 404 si no existe. */
export async function resolveAssignmentByAssignmentId(
  assignmentId: string,
  companyId: string,
): Promise<{
  dienst: IDienst;
  assignment: IDienstAssignment;
}> {
  const raw = String(companyId).trim();
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }
  const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);
  const companyOid = new mongoose.Types.ObjectId(raw);
  const dienst = await Dienst.findOne({
    "assignments._id": assignmentObjectId,
    companyId: companyOid,
  });

  if (!dienst) {
    throw new WorkdaySummaryError(
      "Dienst no encontrado con ese assignmentId",
      404,
    );
  }

  const assignment = dienst.assignments.find(
    (a) => a._id?.toString() === assignmentObjectId.toString(),
  );
  if (!assignment) {
    throw new WorkdaySummaryError("Asignación no encontrada", 404);
  }

  return { dienst, assignment };
}

/** Admin: mismo companyId. Worker: participante y mismo companyId. */
export function assertUserCanCloseAssignment(
  dienst: { companyId?: unknown },
  assignment: { driver?: mongoose.Types.ObjectId; medic?: mongoose.Types.ObjectId },
  userId: string,
  userRole: string,
  userCompanyId?: string | null,
): void {
  const callerCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  if (!callerCo || !mongoose.Types.ObjectId.isValid(callerCo)) {
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }
  const dienstCompanyStr = dienst.companyId ? String(dienst.companyId) : "";
  if (!dienstCompanyStr || dienstCompanyStr !== callerCo) {
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }

  if (userRole === "admin") {
    return;
  }

  const driverStr = assignment.driver?.toString();
  const medicStr = assignment.medic?.toString();
  const isParticipant = driverStr === userId || medicStr === userId;
  if (!isParticipant) {
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }
}
