// backend/src/modules/diensts/assignments/index.ts
// FASE 1: getAssignedDaysForUser modularizado; resto legacy

export { getAssignedDaysForUser } from "./controllers/assigned-days.controller";
export {
  updateDienstPartial,
  removeAssignment,
  assignTeamToWeek,
  assignUserToWeek,
  clearPeopleForWeek,
} from "../../../controllers/dienstController";
