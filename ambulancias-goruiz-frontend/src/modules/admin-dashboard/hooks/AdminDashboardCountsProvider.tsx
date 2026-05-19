import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../../../hooks/useAuth";
import {
  getAdminDashboardCounts,
  type AdminDashboardCounts,
} from "../domain/api";
import { useWorkdaySummariesChanged } from "../../workday/hooks/useWorkdaySummariesChanged";
import { useVacationRequestsUpdated } from "../../vacation/hooks/useVacationRequestsUpdated";
import { useMechanicsIssuesChanged } from "../../mechanics/hooks/useMechanicsIssuesChanged";
import { useAppointmentsChanged } from "../../appointments/hooks/useAppointmentsChanged";
import { useSickLeavesChanged } from "../../sick/hooks/useSickLeavesChanged";
import { PRAEMIEN_MANUAL_PENDING_CHANGED } from "../../praemien/utils/praemienManualPendingEvents";

const ZERO_COUNTS: AdminDashboardCounts = {
  vacations: 0,
  summaries: 0,
  appointments: 0,
  mechanics: 0,
  sickLeaves: 0,
  praemienManual: 0,
};

type AdminDashboardCountsContextValue = {
  counts: AdminDashboardCounts;
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
};

const AdminDashboardCountsContext =
  createContext<AdminDashboardCountsContextValue | null>(null);

export function AdminDashboardCountsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { token, enabledModules } = useAuth();
  const [counts, setCounts] = useState<AdminDashboardCounts>(ZERO_COUNTS);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  const fetchCounts = useCallback(async () => {
    if (!token || enabledModules === null) return;

    setIsLoading(!hasLoadedRef.current);
    try {
      const next = await getAdminDashboardCounts();
      if (!mountedRef.current) return;
      hasLoadedRef.current = true;
      setCounts(next);
      setIsLoading(false);
      setIsError(false);
    } catch (err) {
      if (!mountedRef.current) return;
      setIsLoading(false);
      setIsError(true);
      // eslint-disable-next-line no-console
      console.warn("[AdminDashboardCountsProvider]", err);
    }
  }, [token, enabledModules]);

  const refresh = useCallback(() => {
    void fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    mountedRef.current = true;
    if (token && enabledModules !== null) {
      void fetchCounts();
    } else {
      hasLoadedRef.current = false;
      setCounts(ZERO_COUNTS);
      setIsLoading(false);
      setIsError(false);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCounts, token, enabledModules]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  useWorkdaySummariesChanged(refresh);
  useVacationRequestsUpdated(refresh);
  useMechanicsIssuesChanged(refresh);
  useAppointmentsChanged(refresh);
  useSickLeavesChanged(refresh);

  useEffect(() => {
    const onPraemienChanged = () => refresh();
    window.addEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onPraemienChanged);
    return () =>
      window.removeEventListener(
        PRAEMIEN_MANUAL_PENDING_CHANGED,
        onPraemienChanged,
      );
  }, [refresh]);

  return (
    <AdminDashboardCountsContext.Provider
      value={{ counts, isLoading, isError, refresh }}
    >
      {children}
    </AdminDashboardCountsContext.Provider>
  );
}

export function useAdminDashboardCounts(): AdminDashboardCountsContextValue {
  const ctx = useContext(AdminDashboardCountsContext);
  if (!ctx) {
    throw new Error(
      "useAdminDashboardCounts must be used within AdminDashboardCountsProvider",
    );
  }
  return ctx;
}
