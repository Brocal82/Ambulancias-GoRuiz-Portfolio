import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { getAssignedDaysForUser } from "../../diensts/domain/api";
import type { AssignedDay } from "../../diensts/domain/types";
import { useDienstsChanged } from "../../diensts/hooks/useDienstsChanged";
import {
  assignedDayDateKey,
  dienstNumberToSoftCalendarBg,
} from "../utils/dienstCalendarTints";

/**
 * Días con asignación Dienst (tonos del calendario Prämie).
 * `targetUserId`: trabajador a consultar (trabajador = propio; admin = userId visto).
 */
export function usePraemienDienstDayTints(
  targetUserId: string | null | undefined,
) {
  const { token } = useAuth();
  const [dienstByDate, setDienstByDate] = useState(
    () => new Map<string, AssignedDay>(),
  );

  const load = useCallback(async () => {
    if (!targetUserId?.trim() || !token) {
      setDienstByDate(new Map());
      return;
    }
    try {
      const list = await getAssignedDaysForUser(targetUserId.trim(), token);
      const m = new Map<string, AssignedDay>();
      for (const d of list) {
        m.set(assignedDayDateKey(d.date), d);
      }
      setDienstByDate(m);
    } catch {
      setDienstByDate(new Map());
    }
  }, [targetUserId, token]);

  const ref = useRef(load);
  ref.current = load;
  useEffect(() => {
    void load();
  }, [load]);
  useDienstsChanged(() => {
    void ref.current();
  });

  const dayBaseClassName = useCallback(
    (dateKey: string) => {
      const a = dienstByDate.get(dateKey);
      return a ? dienstNumberToSoftCalendarBg(a.dienstNumber) : undefined;
    },
    [dienstByDate],
  );

  return { dayBaseClassName, dienstByDate };
}
