// backend/src/modules/diensts/assignments/index.ts
// FASE 1+2: getAssignedDaysForUser, removeAssignment modularizados; resto legacy

export { getAssignedDaysForUser } from "./controllers/assigned-days.controller";
export { removeAssignment } from "./controllers/remove-assignment.controller";
export {
  updateDienstPartial,
  assignTeamToWeek,
  assignUserToWeek,
  clearPeopleForWeek,
} from "../../../controllers/dienstController";
