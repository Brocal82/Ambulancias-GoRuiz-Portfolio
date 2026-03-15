import VacationRequest from "../models/vacation-request.model";

export async function getAllVacationRequests() {
  return VacationRequest.find().populate("user", "name lastName email");
}

export async function getVacationRequestsForUser(userId: string) {
  return VacationRequest.find({ user: userId }).populate(
    "user",
    "name lastName email",
  );
}

export async function countVacationRequestsByStatus(status: string) {
  return VacationRequest.countDocuments({ status });
}
