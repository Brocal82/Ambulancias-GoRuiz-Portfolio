import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AdminManualPraemieQueueColumnHeaders,
  AdminManualPraemieQueueRowBody,
} from "../components/AdminManualPraemieQueueRowTable";
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

const rowKey = (r: { userId: string; date: string }) => `${r.userId}|${r.date}`;

export default function AdminPraemienPage() {
  const { t } = useTranslation("common");

  const [rows, setRows] = useState<AdminManualPraemiePendingListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [rectifyInput, setRectifyInput] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [finalValueErrors, setFinalValueErrors] = useState<Record<string, boolean>>({});

  const initialLoadDoneRef = useRef(false);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
    return () => window.removeEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
  }, [load]);

  const clearDrafts = (k: string) => {
    setRectifyInput((prev) => { const n = { ...prev }; delete n[k]; return n; });
    setFinalValueErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
    setExpandedKey((prev) => (prev === k ? null : prev));
  };

  const toggleExpanded = (k: string) => {
    setExpandedKey((prev) => (prev === k ? null : k));
  };

  const handleApprove = async (row: AdminManualPraemiePendingListEntry) => {
    const k = rowKey(row);
    const rawRectify = (rectifyInput[k] ?? "").trim();
    if (rawRectify === "") {
      setFinalValueErrors((prev) => ({ ...prev, [k]: true }));
      return;
    }
    let body: Parameters<typeof postAdminManualDailyApprove>[0] = {
      userId: row.userId,
      date: row.date,
    };
    const parsed = parseManualPraemieClientValue(rawRectify);
    if (!parsed.ok) {
      toastT.error(t("pages.praemien.adminManual.invalidCorrect"));
      return;
    }
    body = { ...body, adminFinalValue: parsed.value };
    setBusyKey(k);
    try {
      const result = await postAdminManualDailyApprove(body);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {t("pages.adminUsers.titlePraemiePendingQueue")}
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            {t("pages.praemien.adminManual.queueExpandHint")}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
          {loading && rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">
              {t("pages.adminUsers.praemiePendingBannerLoading")}
            </p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">
              {t("pages.adminUsers.praemiePendingListEmpty")}
            </p>
          ) : (
            <div className="min-w-0">
              <div
                className="w-full min-w-0 text-xs"
                role="region"
                aria-label={t("pages.adminUsers.titlePraemiePendingQueue")}
              >
                <AdminManualPraemieQueueColumnHeaders />
                {rows.map((row) => {
                  const k = rowKey(row);
                  return (
                    <AdminManualPraemieQueueRowBody
                      key={k}
                      row={pendingListEntryToQueueRowData(row)}
                      rectifyInput={rectifyInput[k] ?? ""}
                      onRectifyChange={(value) => {
                        setRectifyInput((prev) => ({ ...prev, [k]: value }));
                        setFinalValueErrors((prev) => {
                          if (!prev[k]) return prev;
                          const next = { ...prev };
                          delete next[k];
                          return next;
                        });
                      }}
                      onApprove={() => void handleApprove(row)}
                      busy={busyKey === k}
                      finalValueError={Boolean(finalValueErrors[k])}
                      onReopen={() => {}}
                      expandable
                      expanded={expandedKey === k}
                      onToggleExpand={() => toggleExpanded(k)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
