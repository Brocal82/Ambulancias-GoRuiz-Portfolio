// backend/src/modules/diensts/assignments/index.ts
// FASE 1+2+3+4+5: getAssignedDaysForUser, removeAssignment, clearPeopleForWeek, updateDienstPartial, assignUserToWeek modularizados; resto legacy

export { getAssignedDaysForUser } from "./controllers/assigned-days.controller";
export { removeAssignment } from "./controllers/remove-assignment.controller";
export { clearPeopleForWeek } from "./controllers/clear-people.controller";
export { updateDienstPartial } from "./controllers/update-dienst-partial.controller";
export { assignUserToWeek } from "./controllers/assign-user-to-week.controller";
export { assignTeamToWeek } from "../../../controllers/dienstController";
