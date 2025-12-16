//src/models/vacationRequest.ts
import { Schema, model, Document } from "mongoose";
import type { IVacationRequest } from "../types/vacationRequest";

export interface IVacationRequestModel extends IVacationRequest, Document {}

const VacationRequestSchema = new Schema<IVacationRequest>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  requestedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "accepted", "cancelled", "option_sent"],
    default: "pending",
  },
  adminOptionStartDate: { type: Date },
  adminOptionEndDate: { type: Date },
  adminNote: { type: String },
  userResponse: { type: String, enum: ["accepted", "cancelled"] },
});

export default model<IVacationRequest>(
  "VacationRequest",
  VacationRequestSchema,
);
