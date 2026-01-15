// frontend/src/hooks/vacation/useVacationRequestsSync.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { IVacationRequest } from "../../types/vacationRequest";
import {
  useVacationRequestsUpdated,
} from "./useVacationRequestsUpdated";
import type { VacationRequestsUpdatedDetail } from "../../utils/vacation/vacationEvents";
import { toastT } from "../../utils/toast";

type UseVacationRequestsSyncParams = {
  token: string | null | undefined;

  /**
   * Función que obtiene las requests (Admin o Worker).
   * La pasamos desde la page para no acoplar el hook a un endpoint concreto.
   */
  fetcher: (token: string) => Promise<IVacationRequest[]>;

  /**
   * Si estás en una pantalla donde no quieres cargar todavía (por ejemplo sin token),
   * puedes desactivar el hook.
   */
  enabled?: boolean;

  /**
   * Debounce para agrupar varios eventos seguidos (created/accepted/cancelled/etc.)
   */
  debounceMs?: number;

    /**
   * Key de toast de error (opcional) si quieres mostrar toast al fallar el fetch
   */
  onErrorToastKey?: string;

    /**
   * Callback opcional que se ejecuta después de un fetch OK.
   * Útil para lógica de UI en páginas (ej: showForm si no hay requests).
   */
  onAfterFetch?: (data: IVacationRequest[]) => void;


};

type UseVacationRequestsSyncResult = {
  requests: IVacationRequest[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Hook de dominio: sincroniza la lista de vacaciones con eventos "vacation-requests-updated".
 * - Hace fetch inicial
 * - Escucha eventos y hace refetch con debounce
 * - Expone requests/loading/error/refetch
 */
export function useVacationRequestsSync(
  params: UseVacationRequestsSyncParams,
): UseVacationRequestsSyncResult {
  const { token, fetcher, enabled = true, debounceMs = 150, onErrorToastKey, onAfterFetch } = params;

    // ✅ Guardia unificada: solo podemos hacer fetch si el hook está habilitado y hay token
  // (No cambia el comportamiento: antes se comprobaba en doFetch y scheduleRefetch)
  const canFetch = enabled && !!token;




  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetchTimerRef = useRef<number | null>(null);

    // ✅ Helper interno: limpia el timer pendiente (si existe)
  // No cambia comportamiento: es exactamente el mismo cleanup que ya hacíamos en el return del useEffect.
  const clearRefetchTimer = useCallback(() => {
    if (refetchTimerRef.current) {
      window.clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = null;
    }
  }, []);


  const doFetch = useCallback(async () => {
    if (!canFetch) return;

    // ✅ Narrowing de TS: a partir de aquí token es string seguro
    if (!token) return;

    setLoading(true);
    setError(null);


    try {
      const data = await fetcher(token);
setRequests(data);
onAfterFetch?.(data);

    } catch {
  setError("load_error");
  if (onErrorToastKey) {
    // Importa toastT arriba si aún no lo tienes
    // import { toastT } from "../../utils/toast";
    toastT.error([onErrorToastKey]);
  }
}
 finally {
      setLoading(false);
    }
    }, [canFetch, token, fetcher]);


  const scheduleRefetch = useCallback(() => {
        if (!canFetch) return;


    if (refetchTimerRef.current) return;

    refetchTimerRef.current = window.setTimeout(() => {
      refetchTimerRef.current = null;
      doFetch();
    }, debounceMs);
    }, [canFetch, doFetch, debounceMs]);


  // Fetch inicial / cuando cambie token/enabled/fetcher
  useEffect(() => {
    doFetch();

return () => {
  if (refetchTimerRef.current) {
    window.clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = null;
  }
};

}, [doFetch, clearRefetchTimer]);


  // Escucha eventos requests-updated (misma pestaña + otras pestañas)
  const handleRequestsUpdated = useCallback(
    (_detail: VacationRequestsUpdatedDetail) => {
      // No usamos detail ahora mismo; refetch es suficiente
      scheduleRefetch();
    },
    [scheduleRefetch],
  );

  useVacationRequestsUpdated(handleRequestsUpdated);

  return {
    requests,
    loading,
    error,
    refetch: doFetch,
  };
}
