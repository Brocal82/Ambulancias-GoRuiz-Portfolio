//src/types/vacationRequest.ts

import mongoose from "mongoose";

export interface IVacationRequest {
  user: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  requestedAt: Date;
  status: "pending" | "accepted" | "cancelled" | "option_sent";
  adminOptionStartDate?: Date;
  adminOptionEndDate?: Date;
  adminNote?: string;
  userResponse?: "accepted" | "cancelled";
}
