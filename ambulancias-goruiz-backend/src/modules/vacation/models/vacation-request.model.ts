import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";
import type { IVacationRequest } from "../types/vacation-request.types";

export type IVacationRequestModel = HydratedDocument<IVacationRequest>;

const VacationRequestSchema = new Schema<IVacationRequest>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Company",
    required: false,
    default: null,
    index: true,
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  requestedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "accepted", "cancelled", "option_sent", "cancel_requested"],
    default: "pending",
  },
  adminOptionStartDate: { type: Date },
  adminOptionEndDate: { type: Date },
  adminNote: { type: String },
  userResponse: { type: String, enum: ["accepted", "cancelled"] },
});

const VacationRequest: Model<IVacationRequest> =
  (models.VacationRequest as Model<IVacationRequest>) ||
  model<IVacationRequest>("VacationRequest", VacationRequestSchema);

export default VacationRequest;
