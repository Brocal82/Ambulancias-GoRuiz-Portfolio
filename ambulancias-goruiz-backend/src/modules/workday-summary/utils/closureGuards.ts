import mongoose from "mongoose";
import WorkdaySummary from "../models/workday-summary.model";
import { WorkdaySummaryError } from "../../../utils/assignmentClosure";

/** Blocks partial/final closure when a final closure already exists for assignment+date. */
export async function assertNoFinalClosureExists(
  assignmentId: string,
  date: string,
  companyId?: mongoose.Types.ObjectId | null,
): Promise<void> {
  const filter: Record<string, unknown> = {
    assignmentId,
    date,
    isFinalClosure: true,
  };
  if (companyId) {
    filter.companyId = companyId;
  }
  const existing = await WorkdaySummary.findOne(filter).select("_id").lean();
  if (existing) {
    throw new WorkdaySummaryError(
      "Ya existe un cierre final para este día y asignación.",
      409,
    );
  }
}
