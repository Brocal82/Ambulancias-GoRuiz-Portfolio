import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCompanies } from "../../companies/domain/api";
import type { Company } from "../../companies/domain/types";
import {
  createSupportAccessRequest,
  listSupportAccessRequests,
  reviewSupportAccessRequest,
  revokeSupportAccessRequest,
  type SupportAccessRequest,
  type SupportAccessStatus,
} from "../domain/support-access-api";
import { APP_NAV_MATCH_TABLE_THEAD } from "../../../components/ui/appTableHeader";
import StatusBadge from "../../../components/common/StatusBadge";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import { useStepUpSession } from "../../companies/utils/useStepUpSession";

const STATUS_TONES: Record<
  SupportAccessStatus,
  "amber" | "emerald" | "rose" | "slate" | "sky"
> = {
  pending: "amber",
  approved: "emerald",
  denied: "rose",
  revoked: "slate",
  expired: "slate",
};

export default function SuperadminSupportAccessPage() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [rows, setRows] = useState<SupportAccessRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | SupportAccessStatus>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [reason, setReason] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const { requestStepUpToken, stepUpModal } = useStepUpSession();

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSupportAccessRequests(
        statusFilter || undefined,
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      toastT.error(getApiErrorMessage(e, t("pages.superadminSupportAccess.loadError")));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getCompanies();
        if (!cancelled) setCompanies(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCompanies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId.trim() || !reason.trim() || !ticketId.trim()) {
      toastT.error(t("pages.superadminSupportAccess.formRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await createSupportAccessRequest({
        companyId,
        reason: reason.trim(),
        ticketId: ticketId.trim(),
        durationMinutes,
      });
      toastT.success(t("pages.superadminSupportAccess.createSuccess"));
      setShowForm(false);
      setReason("");
      setTicketId("");
      await loadRows();
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, t("pages.superadminSupportAccess.createError")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: string, approve: boolean) => {
    const comment = approve
      ? window.prompt(t("pages.superadminSupportAccess.reviewCommentPrompt"))
      : window.prompt(t("pages.superadminSupportAccess.denyCommentPrompt"));
    if (comment === null) return;
    try {
      let stepUpToken: string | undefined;
      if (approve) {
        stepUpToken =
          (await requestStepUpToken(
            t("pages.superadminSupportAccess.approveStepUp"),
          )) ?? undefined;
        if (!stepUpToken) return;
      }
      await reviewSupportAccessRequest(
        id,
        {
          approve,
          reviewComment: comment.trim() || undefined,
        },
        stepUpToken,
      );
      toastT.success(
        approve
          ? t("pages.superadminSupportAccess.approveSuccess")
          : t("pages.superadminSupportAccess.denySuccess"),
      );
      await loadRows();
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, t("pages.superadminSupportAccess.reviewError")));
    }
  };

  const handleRevoke = async (id: string) => {
    const revokeReason = window.prompt(t("pages.superadminSupportAccess.revokePrompt"));
    if (revokeReason === null) return;
    try {
      await revokeSupportAccessRequest(id, revokeReason.trim() || undefined);
      toastT.success(t("pages.superadminSupportAccess.revokeSuccess"));
      await loadRows();
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, t("pages.superadminSupportAccess.revokeError")));
    }
  };

  const companyName = (cid: string) =>
    companies.find((c) => c._id === cid)?.name ?? cid;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t("pages.superadminSupportAccess.title")}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t("pages.superadminSupportAccess.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {showForm
            ? t("pages.superadminSupportAccess.cancelForm")
            : t("pages.superadminSupportAccess.newRequest")}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-800">
            {t("pages.superadminSupportAccess.formTitle")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.superadminSupportAccess.company")}
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              >
                <option value="">{t("pages.superadminSupportAccess.selectCompany")}</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.superadminSupportAccess.ticketId")}
              </label>
              <input
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.superadminSupportAccess.reason")}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.superadminSupportAccess.duration")}
              </label>
              <input
                type="number"
                min={5}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting
              ? t("pages.superadminSupportAccess.submitting")
              : t("pages.superadminSupportAccess.submit")}
          </button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-700">
          {t("pages.superadminSupportAccess.filterStatus")}
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | SupportAccessStatus)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("pages.superadminSupportAccess.allStatuses")}</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="denied">denied</option>
          <option value="revoked">revoked</option>
          <option value="expired">expired</option>
        </select>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="text-sm text-blue-600 hover:underline"
        >
          {t("pages.superadminSupportAccess.refresh")}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-600">{t("pages.superadminSupportAccess.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-600">{t("pages.superadminSupportAccess.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className={`${APP_NAV_MATCH_TABLE_THEAD} text-left text-slate-200`}>
              <tr>
                <th className="px-4 py-3 font-semibold">{t("pages.superadminSupportAccess.colCompany")}</th>
                <th className="px-4 py-3 font-semibold">{t("pages.superadminSupportAccess.colTicket")}</th>
                <th className="px-4 py-3 font-semibold">{t("pages.superadminSupportAccess.colStatus")}</th>
                <th className="px-4 py-3 font-semibold text-center">{t("pages.superadminSupportAccess.colApprovals")}</th>
                <th className="px-4 py-3 font-semibold">{t("pages.superadminSupportAccess.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-900">
                    {companyName(String(row.companyId))}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                    {row.ticketId}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={row.status}
                      tone={STATUS_TONES[row.status] ?? "slate"}
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {row.approvalsCount ?? 0}/{row.approvalsRequired ?? 2}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap space-x-2">
                    {row.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleReview(row._id, true)}
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          {t("pages.superadminSupportAccess.approve")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReview(row._id, false)}
                          className="text-xs font-medium text-rose-700 hover:underline"
                        >
                          {t("pages.superadminSupportAccess.deny")}
                        </button>
                      </>
                    )}
                    {row.status === "approved" && (
                      <button
                        type="button"
                        onClick={() => void handleRevoke(row._id)}
                        className="text-xs font-medium text-slate-700 hover:underline"
                      >
                        {t("pages.superadminSupportAccess.revoke")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">{t("pages.superadminSupportAccess.dualApprovalHint")}</p>

      {stepUpModal}
    </div>
  );
}
