// modules/diensts/assignments/index.ts
// Surface estable para transforms usados por UI (AssignmentModal contract).

export {
  toFlexibleFromAssignedDay,
  toFlexibleFromDienstAssignment,
  adaptAssignedDay,
  adaptDienstAssignment,
  toUserRefOrNull,
  normalizeAmbulanceIdToString,
} from "../domain/adapters/assignmentAdapter";
