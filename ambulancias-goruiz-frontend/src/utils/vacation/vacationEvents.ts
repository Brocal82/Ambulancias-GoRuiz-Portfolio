// frontend/src/utils/vacation/vacationEvents.ts
// Barrel file (re-exports) para mantener imports estables

export type { VacationRequestsUpdatedDetail } from "./vacationRequestEvents";
export {
  emitVacationRequestsUpdated,
  subscribeVacationRequestsUpdated,
} from "./vacationRequestEvents";

export type { VacationAvailabilityInvalidatedDetail } from "./vacationAvailabilityEvents";
export {
  emitAvailabilityInvalidated,
  subscribeAvailabilityInvalidated,
} from "./vacationAvailabilityEvents";
