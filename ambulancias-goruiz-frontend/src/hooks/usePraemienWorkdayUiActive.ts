import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useModules } from "./useModules";
import { MODULE_KEYS } from "../constants/modules";
import { isPraemienWorkdayUiActive } from "../modules/workday/utils/isPraemienWorkdayUiActive";

/** Single source for workday prämie-specific UI (Phase 2). */
export function usePraemienWorkdayUiActive(): boolean {
  const { hasModule } = useModules();
  const { praemienMode, praemienModeEffectiveFrom } = useAuth();

  const praemienEnabled = hasModule(MODULE_KEYS.PRAEMIEN);

  return useMemo(
    () =>
      isPraemienWorkdayUiActive({
        praemienEnabled,
        praemienMode,
        praemienModeEffectiveFrom,
      }),
    [praemienEnabled, praemienMode, praemienModeEffectiveFrom],
  );
}
