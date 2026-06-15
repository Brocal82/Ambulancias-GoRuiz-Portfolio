import { useTranslation } from "react-i18next";
import {
  AdminManualPraemieQueueColumnHeaders,
  AdminManualPraemieQueueRowBody,
} from "./AdminManualPraemieQueueRowTable";
import { pendingListEntryToQueueRowData } from "../domain/manualDailyApi";
import {
  manualPraemieQueueRowKey,
  useAdminManualPraemieQueue,
} from "../hooks/useAdminManualPraemieQueue";

interface Props {
  /** When false, skips fetch and shows empty state (e.g. users page filter off). */
  enabled?: boolean;
}

export function AdminManualPraemieQueuePanel({ enabled = true }: Props) {
  const { t } = useTranslation("common");
  const {
    rows,
    loading,
    rectifyInput,
    busyKey,
    expandedKey,
    finalValueErrors,
    toggleExpanded,
    handleRectifyChange,
    handleApprove,
  } = useAdminManualPraemieQueue({ enabled });

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
                  const k = manualPraemieQueueRowKey(row);
                  return (
                    <AdminManualPraemieQueueRowBody
                      key={k}
                      row={pendingListEntryToQueueRowData(row)}
                      rectifyInput={rectifyInput[k] ?? ""}
                      onRectifyChange={(value) => handleRectifyChange(k, value)}
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

export default AdminManualPraemieQueuePanel;
