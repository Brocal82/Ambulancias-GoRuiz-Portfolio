import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Appointment } from "../domain/types";
import {
  getOpenAppointments,
  getCalendarAppointments,
} from "../domain/api";
import { useAppointmentsChanged } from "./useAppointmentsChanged";
import { toastT, getApiErrorMessage } from "../../../utils/toast";

type UseAdminAppointmentsSyncParams = {
  token: string | null | undefined;
  /** Año para el rango del calendario (1 enero - 31 diciembre) */
  year: number;
};

type UseAdminAppointmentsSyncResult = {
  pending: Appointment[];
  confirmedYear: Appointment[];
  loadingPending: boolean;
  loadingConfirmed: boolean;
  refetch: () => Promise<void>;
  /** Actualiza o inserta una cita en la lista de pendientes (p.ej. tras proponer slots) */
  upsertPending: (next: Appointment) => void;
};

/**
 * Hook de dominio: sincroniza pending + confirmed de admin appointments.
 * - Fetch inicial en paralelo
 * - Loading solo en primera carga; refetches en background
 * - Sync reactiva cross-tab (CustomEvent + BroadcastChannel + storage)
 * - Expone upsertPending para actualizaciones optimistas
 */
export function useAdminAppointmentsSync(
  params: UseAdminAppointmentsSyncParams,
): UseAdminAppointmentsSyncResult {
  const { token, year } = params;

  const { fromISO, toISO } = useMemo(() => {
    const from = new Date(year, 0, 1, 0, 0, 0, 0);
    const to = new Date(year, 11, 31, 23, 59, 59, 999);
    return { fromISO: from.toISOString(), toISO: to.toISOString() };
  }, [year]);

  const [pending, setPending] = useState<Appointment[]>([]);
  const [confirmedYear, setConfirmedYear] = useState<Appointment[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingConfirmed, setLoadingConfirmed] = useState(true);

  const hasPendingRef = useRef(false);
  const hasConfirmedRef = useRef(false);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    if (!token) return;

    setLoadingPending((prev) => (!hasPendingRef.current ? true : prev));
    setLoadingConfirmed((prev) => (!hasConfirmedRef.current ? true : prev));

    try {
      const [p, c] = await Promise.all([
        getOpenAppointments(token),
        getCalendarAppointments(fromISO, toISO, token),
      ]);

      if (!mountedRef.current) return;

      setPending(p);
      setConfirmedYear(c);
      hasPendingRef.current = true;
      hasConfirmedRef.current = true;
    } catch (e: unknown) {
      toastT.error(getApiErrorMessage(e, ["toasts.appointments.loadError"]));
    } finally {
      if (mountedRef.current) {
        setLoadingPending(false);
        setLoadingConfirmed(false);
      }
    }
  }, [token, fromISO, toISO]);

  const refreshPending = useCallback(async () => {
    if (!token) return;

    setLoadingPending((prev) => (!hasPendingRef.current ? true : prev));
    try {
      const p = await getOpenAppointments(token);
      if (!mountedRef.current) return;
      setPending(p);
      hasPendingRef.current = true;
    } catch (e: unknown) {
      toastT.error(getApiErrorMessage(e, ["toasts.appointments.reloadPendingError"]));
    } finally {
      if (mountedRef.current) setLoadingPending(false);
    }
  }, [token]);

  const refreshConfirmed = useCallback(async () => {
    if (!token) return;

    setLoadingConfirmed((prev) => (!hasConfirmedRef.current ? true : prev));
    try {
      const c = await getCalendarAppointments(fromISO, toISO, token);
      if (!mountedRef.current) return;
      setConfirmedYear(c);
      hasConfirmedRef.current = true;
    } catch (e: unknown) {
      toastT.error(getApiErrorMessage(e, ["toasts.appointments.reloadConfirmedError"]));
    } finally {
      if (mountedRef.current) setLoadingConfirmed(false);
    }
  }, [token, fromISO, toISO]);

  const refetch = useCallback(async () => {
    await Promise.all([refreshPending(), refreshConfirmed()]);
  }, [refreshPending, refreshConfirmed]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useAppointmentsChanged(() => void refetchRef.current?.());

  useEffect(() => {
    mountedRef.current = true;
    if (token) {
      void doFetch();
    } else {
      setLoadingPending(false);
      setLoadingConfirmed(false);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [token, doFetch]);

  const upsertPending = useCallback((next: Appointment) => {
    setPending((prev) => {
      const idx = prev.findIndex((p) => p._id === next._id);
      if (idx !== -1) {
        const old = prev[idx];
        const merged: Appointment = {
          ...next,
          workerId:
            typeof next.workerId === "string" ? old.workerId : next.workerId,
        };
        const copy = [...prev];
        copy[idx] = merged;
        return copy;
      }
      return [next, ...prev];
    });
  }, []);

  return {
    pending,
    confirmedYear,
    loadingPending,
    loadingConfirmed,
    refetch,
    upsertPending,
  };
}
