// src/hooks/vacation/useVacationMonthGridRefresh.ts
import { useCallback, useState } from "react";
import { getVacationAvailability } from "../../api/vacation";
import { useVacationAvailabilityInvalidation } from "./useVacationAvailabilityInvalidation";

type Options = {
  /** Año inicial del grid. Por defecto: año actual */
  initialYear?: number;
  /**
   * Si true: solo refresca cuando la invalidación sea del año actualmente visible.
   * Útil para Admin (si estás navegando por años).
   */
  onlyWhenYearMatchesVisible?: boolean;
};

export function useVacationMonthGridRefresh(options: Options = {}) {
  const {
    initialYear = new Date().getFullYear(),
    onlyWhenYearMatchesVisible = false,
  } = options;

  // Año que está viendo el usuario en el grid
  const [gridYear, setGridYear] = useState<number>(initialYear);

  // Tick para forzar rerender del grid (key)
  const [gridRefreshTick, setGridRefreshTick] = useState(0);

  // Refresca caché del mes concreto y sube el tick
  const forceRefreshMonth = useCallback(async (y: number, m1: number) => {
    try {
      await getVacationAvailability({ year: y, month: m1 }, { force: true });
    } catch {
      // silencioso: el objetivo es forzar re-render/rehidratar caché
    }
    setGridRefreshTick((n) => n + 1);
  }, []);

  // Escucha invalidaciones y refresca el mes afectado
  useVacationAvailabilityInvalidation(({ year, month }) => {
    if (onlyWhenYearMatchesVisible && year !== gridYear) return;
    forceRefreshMonth(year, month);
  });

  return {
    gridYear,
    setGridYear,
    gridRefreshTick,
    forceRefreshMonth,
  };
}
