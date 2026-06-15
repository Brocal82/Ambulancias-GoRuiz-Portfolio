import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAdminManualPraemiePendingEntries,
  pendingListEntryToQueueRowData,
  postAdminManualDailyApprove,
  type AdminManualPraemiePendingListEntry,
} from "../domain/manualDailyApi";
import { parseManualPraemieClientValue } from "../utils/parseManualPraemieClientValue";
import { showManualApproveSuccessToast } from "../utils/showManualApproveSuccessToast";
import {
  PRAEMIEN_MANUAL_PENDING_CHANGED,
  dispatchPraemienManualPendingChanged,
} from "../utils/praemienManualPendingEvents";
import { toastT } from "../../../utils/toast";

export function manualPraemieQueueRowKey(r: { userId: string; date: string }) {
  return `${r.userId}|${r.date}`;
}

export function useAdminManualPraemieQueue(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { t } = useTranslation("common");

  const [rows, setRows] = useState<AdminManualPraemiePendingListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [rectifyInput, setRectifyInput] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [finalValueErrors, setFinalValueErrors] = useState<
    Record<string, boolean>
  >({});

  const initialLoadDoneRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setRows([]);
      initialLoadDoneRef.current = false;
      setLoading(false);
      return;
    }

    const blocking = !initialLoadDoneRef.current;
    if (blocking) setLoading(true);
    try {
      const data = await getAdminManualPraemiePendingEntries();
      setRows(data);
    } catch {
      setRows([]);
      toastT.error(["pages.adminUsers.praemiePendingListLoadError"]);
    } finally {
      initialLoadDoneRef.current = true;
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const onChanged = () => void load();
    window.addEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
    return () =>
      window.removeEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
  }, [load, enabled]);

  const clearDrafts = (k: string) => {
    setRectifyInput((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setFinalValueErrors((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setExpandedKey((prev) => (prev === k ? null : prev));
  };

  const toggleExpanded = (k: string) => {
    setExpandedKey((prev) => (prev === k ? null : k));
  };

  const handleRectifyChange = (k: string, value: string) => {
    setRectifyInput((prev) => ({ ...prev, [k]: value }));
    setFinalValueErrors((prev) => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const handleApprove = async (row: AdminManualPraemiePendingListEntry) => {
    const k = manualPraemieQueueRowKey(row);
    const rawRectify = (rectifyInput[k] ?? "").trim();
    if (rawRectify === "") {
      setFinalValueErrors((prev) => ({ ...prev, [k]: true }));
      return;
    }

    const parsed = parseManualPraemieClientValue(rawRectify);
    if (!parsed.ok) {
      toastT.error(t("pages.praemien.adminManual.invalidCorrect"));
      return;
    }

    setBusyKey(k);
    try {
      const result = await postAdminManualDailyApprove({
        userId: row.userId,
        date: row.date,
        adminFinalValue: parsed.value,
      });
      showManualApproveSuccessToast(
        t,
        pendingListEntryToQueueRowData(row),
        result.syncedTeammateUserIds,
      );
      dispatchPraemienManualPendingChanged();
      clearDrafts(k);
      await load();
    } catch {
      toastT.error(["pages.adminUsers.praemiePendingListApproveError"]);
    } finally {
      setBusyKey(null);
    }
  };

  return {
    rows,
    loading,
    rectifyInput,
    busyKey,
    expandedKey,
    finalValueErrors,
    toggleExpanded,
    handleRectifyChange,
    handleApprove,
  };
}
