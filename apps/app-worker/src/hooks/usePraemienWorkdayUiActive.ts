import { useEffect, useState } from "react";

import { getMyCompanyPraemienConfig } from "../services/company";
import { CompanyModuleKey, MODULE_KEYS } from "../types/auth";
import { isPraemienWorkdayUiActive } from "../utils/isPraemienWorkdayUiActive";

export function usePraemienWorkdayUiActive(enabledModules?: CompanyModuleKey[]): boolean {
  const hasPraemienModule = enabledModules?.includes(MODULE_KEYS.PRAEMIEN) ?? false;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!hasPraemienModule) {
      setActive(false);
      return;
    }
    let cancelled = false;
    void getMyCompanyPraemienConfig()
      .then((cfg) => {
        if (cancelled) return;
        setActive(
          isPraemienWorkdayUiActive({
            praemienEnabled: true,
            praemienMode: cfg.praemienMode,
            praemienModeEffectiveFrom: cfg.praemienModeEffectiveFrom,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasPraemienModule]);

  return active;
}
