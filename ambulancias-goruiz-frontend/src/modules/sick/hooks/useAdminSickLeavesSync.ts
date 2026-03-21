import { useCallback, useEffect, useRef, useState } from "react";
import type { SickLeave } from "../domain/types";
import { adminListSickLeaves } from "../domain/api";
import { useSickLeavesChanged } from "./useSickLeavesChanged";

type UseAdminSickLeavesSyncParams = {
  token: string | null | undefined;
};

type UseAdminSickLeavesSyncResult = {
  allItems: SickLeave[];
  refetch: () => Promise<void>;
};

/**
 * Hook de dominio: sincroniza la lista de bajas (admin).
 * - Fetch inicial
 * - Sync reactiva cross-tab (CustomEvent + BroadcastChannel + storage)
 * - Sin loading state (mantiene comportamiento original: grid vacío hasta datos)
 */
export function useAdminSickLeavesSync(
  params: UseAdminSickLeavesSyncParams,
): UseAdminSickLeavesSyncResult {
  const { token } = params;

  const [allItems, setAllItems] = useState<SickLeave[]>([]);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    if (!token) return;
    try {
      const data = await adminListSickLeaves({});
      if (mountedRef.current) {
        setAllItems(data);
      }
    } catch (err: unknown) {
      console.error("[useAdminSickLeavesSync]", err);
    }
  }, [token]);

  const refetchRef = useRef(doFetch);
  refetchRef.current = doFetch;

  useSickLeavesChanged(() => void refetchRef.current?.());

  useEffect(() => {
    mountedRef.current = true;
    if (token) {
      void doFetch();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [token, doFetch]);

  return {
    allItems,
    refetch: doFetch,
  };
}
