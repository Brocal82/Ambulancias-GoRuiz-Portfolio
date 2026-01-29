// backend/src/modules/diensts/assignments/index.ts
// FASE 1: capa de compatibilidad -> re-export de legacy (NO refactor aún)

export {
  updateDienstPartial,
  removeAssignment,
  getAssignedDaysForUser,
  assignTeamToWeek,
  assignUserToWeek,
  clearPeopleForWeek,
  swapWeekRoles,
} from "../../../controllers/dienstController";
