import { useEffect, useState } from "react";

import { getVacationFlagsInRange, type VacFlag } from "../../../../../modules/vacation/domain/api";
import { getSickFlagsInRange, type SickFlag } from "../../../../sick/domain";
import { useModules } from "../../../../../hooks/useModules";
import { MODULE_KEYS } from "../../../../../constants/modules";

export const useDayFlags = (params: {
  isOpen: boolean;
  token: string | null | undefined;
  date: string;
  userIds: string[];
}) => {
  const { isOpen, token, date, userIds } = params;
  const { hasModule } = useModules();
  const vacationModuleOn = hasModule(MODULE_KEYS.VACATION);
  const sickLeavesModuleOn = hasModule(MODULE_KEYS.SICK_LEAVES);

  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>({});
  const [sickFlags, setSickFlags] = useState<Record<string, SickFlag>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !token || !date) return;

    if (userIds.length === 0) {
      setVacationFlags({});
      setSickFlags({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setFlagsLoading(true);

        const vacPromise = vacationModuleOn
          ? getVacationFlagsInRange({
              userIds,
              fromISO: date,
              toISO: date,
              includeFullSpan: true,
            })
          : Promise.resolve({} as Record<string, VacFlag>);

        const sickPromise = sickLeavesModuleOn
          ? getSickFlagsInRange({
              userIds,
              fromISO: date,
              toISO: date,
              includeFullSpan: true,
            })
          : Promise.resolve({} as Record<string, SickFlag>);

        const [vacFlags, sickFlagsRes] = await Promise.all([
          vacPromise,
          sickPromise,
        ]);

        if (!cancelled) {
          setVacationFlags(vacFlags);
          setSickFlags(sickFlagsRes);
        }
      } catch (e) {
        console.error("❌ Error al obtener flags (día):", e);
        if (!cancelled) {
          setVacationFlags({});
          setSickFlags({});
        }
      } finally {
        if (!cancelled) setFlagsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token, date, userIds, vacationModuleOn, sickLeavesModuleOn]);

  return { vacationFlags, sickFlags, flagsLoading };
};


