// backend/src/modules/diensts/assignments/index.ts
// FASE 1+2+3: getAssignedDaysForUser, removeAssignment, clearPeopleForWeek modularizados; resto legacy

export { getAssignedDaysForUser } from "./controllers/assigned-days.controller";
export { removeAssignment } from "./controllers/remove-assignment.controller";
export { clearPeopleForWeek } from "./controllers/clear-people.controller";
export {
  updateDienstPartial,
  assignTeamToWeek,
  assignUserToWeek,
} from "../../../controllers/dienstController";
