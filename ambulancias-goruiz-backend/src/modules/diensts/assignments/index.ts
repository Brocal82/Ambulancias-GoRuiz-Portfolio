// backend/src/modules/diensts/assignments/index.ts
// Assignments completamente modularizado

export { getAssignedDaysForUser } from "./controllers/assigned-days.controller";
export { removeAssignment } from "./controllers/remove-assignment.controller";
export { clearPeopleForWeek } from "./controllers/clear-people.controller";
export { updateDienstPartial } from "./controllers/update-dienst-partial.controller";
export { assignUserToWeek } from "./controllers/assign-user-to-week.controller";
export { assignTeamToWeek } from "./controllers/assign-team-to-week.controller";
export { moveSlotSameWeek } from "./controllers/move-slot-same-week.controller";
export { dndCrossDienstSameWeek } from "./controllers/dnd-cross-dienst-same-week.controller";
