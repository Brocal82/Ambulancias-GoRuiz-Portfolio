// frontend/src/modules/diensts/domain/payloads.ts
// FASE 2 (Paso 1): Payloads/DTOs del módulo Diensts.
// De momento, definimos aquí los payloads que usa la API del módulo.
// (No rompe nada porque antes estaba vacío.)

export type AssignTeamToWeekPayload = {
  dienstNumber: number;
  weekStartDate: string;
  teamId: string;
  resolvedRoles?: { driverId: string; medicId: string };
};

export type AssignUserToWeekPayload = {
  dienstNumber: number;
  weekStartDate: string;
  userId: string;
  role: "driver" | "medic";
};

export type ClearPeopleForWeekPayload = {
  dienstNumber: number;
  weekStartDate: string;
};

export type UpdateDienstPartialPayload = {
  assignments: Array<{
    _id?: string;
    date: string;
    startTime: string;
    endTime: string;
    ambulanceId?: string | null;
    driver: string;
    medic: string;
  }>;
};




