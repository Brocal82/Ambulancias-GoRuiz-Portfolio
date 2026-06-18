import { isAssignmentForUser } from "./assignmentUserId";
import { toDateKey } from "./workdayAssignment";

export type AgendaDienstAssignment = {
  date?: string;
  startTime?: string;
  endTime?: string;
  driver?: unknown;
  medic?: unknown;
};

export type AgendaDienst = {
  _id: string;
  assignments?: AgendaDienstAssignment[];
};

export type AgendaAssignmentRef = {
  dienstId: string;
  dateKey: string;
  startTime: string;
};

/** Rows included in dynamic agenda: only assignments where user is driver or medic. */
export function collectAgendaAssignmentRefs(
  diensts: AgendaDienst[],
  userId: string,
): AgendaAssignmentRef[] {
  const refs: AgendaAssignmentRef[] = [];
  for (const dienst of diensts) {
    for (const assignment of dienst.assignments ?? []) {
      if (!isAssignmentForUser(assignment, userId)) continue;
      const dateKey = toDateKey(assignment.date);
      if (!dateKey) continue;
      refs.push({
        dienstId: dienst._id,
        dateKey,
        startTime: assignment.startTime ?? "--:--",
      });
    }
  }
  return refs;
}
