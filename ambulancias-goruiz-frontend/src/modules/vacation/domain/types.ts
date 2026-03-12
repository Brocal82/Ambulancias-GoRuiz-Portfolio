// frontend/src/types/vacationRequest.ts
export interface IVacationRequest {
  _id: string; // obligatorio
  user: {
    _id: string;
    name: string;
    lastName: string;
    email?: string;
  };
  startDate: string; // fechas como ISO string en frontend
  endDate: string;
  requestedAt: string;
  status: "pending" | "accepted" | "cancelled" | "option_sent";
  adminOptionStartDate?: string;
  adminOptionEndDate?: string;
  adminNote?: string;
  userResponse?: "accepted" | "cancelled";
}
