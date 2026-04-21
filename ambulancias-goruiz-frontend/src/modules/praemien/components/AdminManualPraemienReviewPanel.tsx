import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAdminManualDailyMonth,
  postAdminManualDailyApprove,
  postAdminManualDailyCorrectApprove,
  postAdminManualDailyReject,
  postAdminManualDailyReopen,
  type ManualDailyEntryDto,
} from "../domain/manualDailyApi";
import { labelPraemienManualStatus } from "../utils/labelPraemienManualStatus";

interface Props {
  userId: string;
}

const AdminManualPraemienReviewPanel = ({ userId }: Props) => {
  const { t } = useTranslation();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<ManualDailyEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ManualDailyEntryDto | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [correctVal, setCorrectVal] = useState("");
  const [reopenNote, setReopenNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminManualDailyMonth(userId, year, month);
      setRows(data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("pages.praemien.adminManual.loadError");
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, [userId, year, month, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      setSelected(null);
      setRejectReason("");
      setCorrectVal("");
      setReopenNote("");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("pages.praemien.adminManual.actionError");
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  const monthLabel = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [year, month],
  );

  return (
    <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h3 className="mb-3 text-base font-semibold text-slate-900">
        {t("pages.praemien.adminManual.title")}
      </h3>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border border-slate-200 px-2 py-1 text-xs"
          onClick={() => {
            if (month === 1) {
              setYear((y) => y - 1);
              setMonth(12);
            } else setMonth((m) => m - 1);
          }}
        >
          {t("pages.praemien.manual.prevMonth")}
        </button>
        <span className="text-sm capitalize text-slate-700">{monthLabel}</span>
        <button
          type="button"
          className="rounded border border-slate-200 px-2 py-1 text-xs"
          onClick={() => {
            if (month === 12) {
              setYear((y) => y + 1);
              setMonth(1);
            } else setMonth((m) => m + 1);
          }}
        >
          {t("pages.praemien.manual.nextMonth")}
        </button>
      </div>

      {error && (
        <p className="mb-2 rounded bg-rose-50 px-2 py-1 text-sm text-rose-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">{t("pages.praemien.adminManual.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t("pages.praemien.adminManual.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs text-slate-800">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-1 pr-2">{t("pages.praemien.adminManual.th.date")}</th>
                <th className="py-1 pr-2">{t("pages.praemien.adminManual.th.original")}</th>
                <th className="py-1 pr-2">{t("pages.praemien.adminManual.th.worker")}</th>
                <th className="py-1 pr-2">{t("pages.praemien.adminManual.th.final")}</th>
                <th className="py-1 pr-2">{t("pages.praemien.adminManual.th.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.date}
                  className={[
                    "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                    selected?.date === r.date ? "bg-blue-50" : "",
                  ].join(" ")}
                  onClick={() => setSelected(r)}
                >
                  <td className="py-1.5 pr-2 font-medium tabular-nums">{r.date}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.originalWorkerValue}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.workerSubmittedValue}</td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {r.adminFinalValue != null ? r.adminFinalValue : "—"}
                  </td>
                  <td className="py-1.5 pr-2">
                    {labelPraemienManualStatus(t, r.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-sm font-medium text-slate-800">
            {t("pages.praemien.adminManual.selected", { date: selected.date })}
          </p>
          {selected.rejectionReason && (
            <p className="text-xs text-rose-700">
              {t("pages.praemien.adminManual.rejectReason", {
                reason: selected.rejectionReason,
              })}
            </p>
          )}
          {(selected.status === "submitted" ||
            selected.status === "draft" ||
            selected.status === "reopened") && (
            <label className="block text-[11px] text-slate-600">
              {t("pages.praemien.adminManual.rejectReasonLabel")}
              <input
                className="mt-0.5 w-full max-w-md rounded border border-slate-300 px-2 py-1 text-xs"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {(selected.status === "submitted" ||
              selected.status === "draft" ||
              selected.status === "reopened") && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await postAdminManualDailyApprove({
                        userId,
                        date: selected.date,
                      });
                    })
                  }
                >
                  {t("pages.praemien.adminManual.approve")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await postAdminManualDailyReject({
                        userId,
                        date: selected.date,
                        reason: rejectReason,
                      });
                    })
                  }
                >
                  {t("pages.praemien.adminManual.reject")}
                </button>
              </>
            )}
            {(selected.status === "submitted" ||
              selected.status === "draft" ||
              selected.status === "reopened") && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-[11px] text-slate-600">
                  {t("pages.praemien.adminManual.correctValue")}
                  <input
                    type="number"
                    className="w-24 rounded border border-slate-300 px-1 py-0.5"
                    value={correctVal}
                    onChange={(e) => setCorrectVal(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() => {
                    const n = Number(correctVal);
                    if (!Number.isInteger(n) || n < 0 || n > 10_000) {
                      setError(t("pages.praemien.adminManual.invalidCorrect"));
                      return;
                    }
                    void run(async () => {
                      await postAdminManualDailyCorrectApprove({
                        userId,
                        date: selected.date,
                        adminFinalValue: n,
                      });
                    });
                  }}
                >
                  {t("pages.praemien.adminManual.correctApprove")}
                </button>
              </div>
            )}
            {selected.status === "approved" && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-[11px] text-slate-600">
                  {t("pages.praemien.adminManual.reopenNote")}
                  <input
                    className="w-48 rounded border border-slate-300 px-1 py-0.5"
                    value={reopenNote}
                    onChange={(e) => setReopenNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await postAdminManualDailyReopen({
                        userId,
                        date: selected.date,
                        note: reopenNote,
                      });
                    })
                  }
                >
                  {t("pages.praemien.adminManual.reopen")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManualPraemienReviewPanel;
