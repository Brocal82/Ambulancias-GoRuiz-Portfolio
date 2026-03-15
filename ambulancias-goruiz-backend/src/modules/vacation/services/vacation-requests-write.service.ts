import mongoose from "mongoose";
import VacationRequest from "../models/vacation-request.model";

export async function createVacationRequestRecord(input: {
  userId: string;
  startDate: string | Date;
  endDate: string | Date;
}) {
  const { userId, startDate, endDate } = input;

  const newRequest = new VacationRequest({
    user: new mongoose.Types.ObjectId(userId),
    startDate,
    endDate,
    status: "pending",
    requestedAt: new Date(),
  });

  await newRequest.save();
  return newRequest;
}

export async function cancelOwnVacationRequest(input: {
  userId: string;
  id: string;
}) {
  const { userId, id } = input;

  const request = await VacationRequest.findById(id);
  if (!request) {
    return { kind: "not_found" as const };
  }

  if (String(request.user) !== String(userId)) {
    return { kind: "forbidden" as const };
  }

  const status = String(request.status);
  if (status !== "pending" && status !== "option_sent") {
    return { kind: "invalid_status" as const };
  }

  request.status = "cancelled";
  await request.save();

  return { kind: "ok" as const, request };
}

export async function deleteVacationRequestRecord(id: string) {
  const request = await VacationRequest.findById(id);
  if (!request) {
    return { kind: "not_found" as const };
  }

  await request.deleteOne();
  return { kind: "ok" as const };
}
