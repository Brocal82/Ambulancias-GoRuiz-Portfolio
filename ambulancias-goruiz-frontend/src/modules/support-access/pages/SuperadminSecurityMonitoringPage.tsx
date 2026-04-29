import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getSecurityAuditLogs,
  getSecurityMonitoringOperationalHealth,
  getSecurityMonthlyReview,
  getSecurityMonitoringSummary,
  getSecurityTenantRisk,
} from "../domain/api";
import type {
  SecurityAuditLogRow,
  SecurityMonthlyReviewSnapshot,
  SecurityMonitoringOperationalHealth,
  SecurityMonitoringSnapshot,
  SecurityTenantRiskRow,
} from "../domain/types";

const WINDOW_OPTIONS = [24, 48, 72, 168];

export default function SuperadminSecurityMonitoringPage() {
  const { t } = useTranslation();
  const [hours, setHours] = useState<number>(24);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SecurityMonitoringSnapshot | null>(null);
  const [auditLoading, setAuditLoading] = useState<boolean>(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<SecurityAuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [health, setHealth] = useState<SecurityMonitoringOperationalHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [tenantRiskRows, setTenantRiskRows] = useState<SecurityTenantRiskRow[]>([]);
  const [tenantRiskLoading, setTenantRiskLoading] = useState<boolean>(true);
  const [tenantRiskError, setTenantRiskError] = useState<string | null>(null);
  const [monthlyReview, setMonthlyReview] = useState<SecurityMonthlyReviewSnapshot | null>(null);
  const [monthlyReviewLoading, setMonthlyReviewLoading] = useState<boolean>(true);
  const [monthlyReviewError, setMonthlyReviewError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<"" | "success" | "denied" | "error">("");
  const [eventFilter, setEventFilter] = useState<string>("");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [tenantFilter, setTenantFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSecurityMonitoringSummary(hours);
        if (!cancelled) {
          setSnapshot(data);
        }
      } catch (err) {
        if (!cancelled) {
          setSnapshot(null);
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [hours]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setMonthlyReviewLoading(true);
      setMonthlyReviewError(null);
      try {
        const data = await getSecurityMonthlyReview(24 * 30);
        if (!cancelled) {
          setMonthlyReview(data);
        }
      } catch (err) {
        if (!cancelled) {
          setMonthlyReview(null);
          setMonthlyReviewError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setMonthlyReviewLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const exportCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const toCell = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(toCell).join(","), ...rows.map((r) => r.map(toCell).join(","))].join(
      "\n",
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setTenantRiskLoading(true);
      setTenantRiskError(null);
      try {
        const data = await getSecurityTenantRisk({ hours, limit: 20 });
        if (!cancelled) {
          setTenantRiskRows(data.rows);
        }
      } catch (err) {
        if (!cancelled) {
          setTenantRiskRows([]);
          setTenantRiskError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setTenantRiskLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hours]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setAuditLoading(true);
      setAuditError(null);
      try {
        const data = await getSecurityAuditLogs({
          hours,
          limit: 50,
          outcome: outcomeFilter,
          event: eventFilter,
          actorUserId: actorFilter,
          tenantCompanyId: tenantFilter,
        });
        if (!cancelled) {
          setAuditRows(data.rows);
          setAuditTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) {
          setAuditRows([]);
          setAuditTotal(0);
          setAuditError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hours, outcomeFilter, eventFilter, actorFilter, tenantFilter]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setHealthLoading(true);
      setHealthError(null);
      try {
        const data = await getSecurityMonitoringOperationalHealth();
        if (!cancelled) {
          setHealth(data);
        }
      } catch (err) {
        if (!cancelled) {
          setHealth(null);
          setHealthError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setHealthLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hours]);

  const cards = useMemo(() => {
    if (!snapshot) return [];
    const s = snapshot.supportAccess;
    return [
      { key: "requested", value: s.requested },
      { key: "denied", value: s.denied },
      { key: "approvalRecorded", value: s.approvalRecorded },
      { key: "approvedFinal", value: s.approvedFinal },
      { key: "revoked", value: s.revoked },
      { key: "expired", value: s.expired },
      { key: "offHoursFinalApprovals", value: s.offHoursFinalApprovals },
    ];
  }, [snapshot]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t("pages.superadminSecurityMonitoring.title")}
          </h1>
          <p className="text-slate-600 mt-1">
            {t("pages.superadminSecurityMonitoring.subtitle")}
          </p>
        </div>
        <Link
          to="/superadmin"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {t("pages.superadminSecurityMonitoring.backToPanel")}
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <label htmlFor="monitoring-hours" className="text-sm font-medium text-slate-700">
          {t("pages.superadminSecurityMonitoring.windowLabel")}
        </label>
        <select
          id="monitoring-hours"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t("pages.superadminSecurityMonitoring.hoursOption", { hours: option })}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
          {t("pages.superadminSecurityMonitoring.loading")}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {t("pages.superadminSecurityMonitoring.loadError")}: {error}
        </div>
      )}

      {!loading && !error && snapshot && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((card) => (
              <div key={card.key} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {t(`pages.superadminSecurityMonitoring.cards.${card.key}`)}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("pages.superadminSecurityMonitoring.metaTitle")}
            </h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p>
                <span className="font-medium">{t("pages.superadminSecurityMonitoring.generatedAt")}: </span>
                {new Date(snapshot.generatedAt).toLocaleString()}
              </p>
              <p>
                <span className="font-medium">{t("pages.superadminSecurityMonitoring.windowHours")}: </span>
                {snapshot.windowHours}
              </p>
              <p>
                <span className="font-medium">{t("pages.superadminSecurityMonitoring.deniedThreshold")}: </span>
                {snapshot.deniedThreshold}
              </p>
              <p>
                <span className="font-medium">{t("pages.superadminSecurityMonitoring.range")}: </span>
                {new Date(snapshot.supportAccess.since).toLocaleString()} -{" "}
                {new Date(snapshot.supportAccess.until).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("pages.superadminSecurityMonitoring.operationalTitle")}
            </h2>
            {healthLoading && (
              <p className="text-sm text-slate-600">
                {t("pages.superadminSecurityMonitoring.operationalLoading")}
              </p>
            )}
            {!healthLoading && healthError && (
              <p className="text-sm text-rose-700">
                {t("pages.superadminSecurityMonitoring.operationalError")}: {healthError}
              </p>
            )}
            {!healthLoading && !healthError && health && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="font-medium">
                      {t("pages.superadminSecurityMonitoring.operationalDb")}:
                    </span>{" "}
                    {health.dbStatus}
                  </p>
                  <p>
                    <span className="font-medium">
                      {t("pages.superadminSecurityMonitoring.operationalCron")}:
                    </span>{" "}
                    {health.monitoringCron}
                  </p>
                  <p>
                    <span className="font-medium">
                      {t("pages.superadminSecurityMonitoring.operationalEnabled")}:
                    </span>{" "}
                    {health.monitoringEnabled ? "true" : "false"}
                  </p>
                  <p>
                    <span className="font-medium">
                      {t("pages.superadminSecurityMonitoring.operationalLastReport")}:
                    </span>{" "}
                    {health.lastDailyReportAt
                      ? new Date(health.lastDailyReportAt).toLocaleString()
                      : "-"}
                  </p>
                </div>
                <div className="space-y-2">
                  {health.alerts.length === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                      {t("pages.superadminSecurityMonitoring.operationalNoAlerts")}
                    </div>
                  ) : (
                    health.alerts.map((alert) => (
                      <div
                        key={alert.code}
                        className={
                          alert.severity === "critical"
                            ? "rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                            : "rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
                        }
                      >
                        <span className="font-medium">{alert.code}:</span> {alert.message}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-slate-900">
                {t("pages.superadminSecurityMonitoring.auditTitle")}
              </h2>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-600">
                  {t("pages.superadminSecurityMonitoring.auditTotal", { total: auditTotal })}
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() =>
                    exportCsv(
                      "security-audit-logs.csv",
                      ["at", "event", "outcome", "actorUserId", "tenantCompanyId", "resourceType", "resourceId", "reason"],
                      auditRows.map((row) => [
                        row.at,
                        row.event,
                        row.outcome,
                        row.actorUserId ?? "",
                        row.tenantCompanyId ?? "",
                        row.resourceType ?? "",
                        row.resourceId ?? "",
                        row.reason ?? "",
                      ]),
                    )
                  }
                >
                  {t("pages.superadminSecurityMonitoring.exportAuditLogs")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={outcomeFilter}
                onChange={(e) =>
                  setOutcomeFilter(e.target.value as "" | "success" | "denied" | "error")
                }
              >
                <option value="">{t("pages.superadminSecurityMonitoring.filters.outcomeAny")}</option>
                <option value="success">{t("pages.superadminSecurityMonitoring.filters.outcomeSuccess")}</option>
                <option value="denied">{t("pages.superadminSecurityMonitoring.filters.outcomeDenied")}</option>
                <option value="error">{t("pages.superadminSecurityMonitoring.filters.outcomeError")}</option>
              </select>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t("pages.superadminSecurityMonitoring.filters.eventPlaceholder")}
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t("pages.superadminSecurityMonitoring.filters.actorPlaceholder")}
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t("pages.superadminSecurityMonitoring.filters.tenantPlaceholder")}
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
              />
            </div>

            {auditLoading && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {t("pages.superadminSecurityMonitoring.auditLoading")}
              </div>
            )}
            {!auditLoading && auditError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {t("pages.superadminSecurityMonitoring.auditError")}: {auditError}
              </div>
            )}
            {!auditLoading && !auditError && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600 border-b border-slate-200">
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.table.at")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.table.event")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.table.outcome")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.table.actor")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.table.tenant")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.table.resource")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((row) => (
                      <tr key={row._id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {new Date(row.at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3">{row.event}</td>
                        <td className="py-2 pr-3">{row.outcome}</td>
                        <td className="py-2 pr-3">{row.actorUserId ?? "-"}</td>
                        <td className="py-2 pr-3">{row.tenantCompanyId ?? "-"}</td>
                        <td className="py-2 pr-3">
                          {[row.resourceType, row.resourceId].filter(Boolean).join(":") || "-"}
                        </td>
                      </tr>
                    ))}
                    {auditRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-slate-500">
                          {t("pages.superadminSecurityMonitoring.table.empty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("pages.superadminSecurityMonitoring.tenantRiskTitle")}
            </h2>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                onClick={() =>
                  exportCsv(
                    "tenant-risk.csv",
                    ["tenantCompanyId", "riskLevel", "riskScore", "requested", "denied", "offHoursFinalApprovals"],
                    tenantRiskRows.map((row) => [
                      row.tenantCompanyId,
                      row.riskLevel,
                      row.riskScore,
                      row.requested,
                      row.denied,
                      row.offHoursFinalApprovals,
                    ]),
                  )
                }
              >
                {t("pages.superadminSecurityMonitoring.exportTenantRisk")}
              </button>
            </div>
            {tenantRiskLoading && (
              <p className="text-sm text-slate-600">
                {t("pages.superadminSecurityMonitoring.tenantRiskLoading")}
              </p>
            )}
            {!tenantRiskLoading && tenantRiskError && (
              <p className="text-sm text-rose-700">
                {t("pages.superadminSecurityMonitoring.tenantRiskError")}: {tenantRiskError}
              </p>
            )}
            {!tenantRiskLoading && !tenantRiskError && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600 border-b border-slate-200">
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.tenantRiskTable.tenant")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.tenantRiskTable.level")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.tenantRiskTable.score")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.tenantRiskTable.requested")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.tenantRiskTable.denied")}</th>
                      <th className="py-2 pr-3">{t("pages.superadminSecurityMonitoring.tenantRiskTable.offHours")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantRiskRows.map((row) => (
                      <tr key={row.tenantCompanyId} className="border-b border-slate-100">
                        <td className="py-2 pr-3">{row.tenantCompanyId}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={
                              row.riskLevel === "high"
                                ? "rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-xs font-medium"
                                : row.riskLevel === "medium"
                                  ? "rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium"
                                  : "rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium"
                            }
                          >
                            {row.riskLevel}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{row.riskScore}</td>
                        <td className="py-2 pr-3">{row.requested}</td>
                        <td className="py-2 pr-3">{row.denied}</td>
                        <td className="py-2 pr-3">{row.offHoursFinalApprovals}</td>
                      </tr>
                    ))}
                    {tenantRiskRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-slate-500">
                          {t("pages.superadminSecurityMonitoring.tenantRiskEmpty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("pages.superadminSecurityMonitoring.monthlyReviewTitle")}
            </h2>
            {monthlyReviewLoading && (
              <p className="text-sm text-slate-600">
                {t("pages.superadminSecurityMonitoring.monthlyReviewLoading")}
              </p>
            )}
            {!monthlyReviewLoading && monthlyReviewError && (
              <p className="text-sm text-rose-700">
                {t("pages.superadminSecurityMonitoring.monthlyReviewError")}: {monthlyReviewError}
              </p>
            )}
            {!monthlyReviewLoading && !monthlyReviewError && monthlyReview && (
              <>
                <p className="text-sm">
                  <span className="font-medium">{t("pages.superadminSecurityMonitoring.monthlyReviewStatus")}:</span>{" "}
                  {monthlyReview.overallStatus}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <p>requested: {monthlyReview.metrics.requested}</p>
                  <p>approvedFinal: {monthlyReview.metrics.approvedFinal}</p>
                  <p>denied: {monthlyReview.metrics.denied}</p>
                  <p>revoked: {monthlyReview.metrics.revoked}</p>
                  <p>expired: {monthlyReview.metrics.expired}</p>
                  <p>offHours: {monthlyReview.metrics.offHoursFinalApprovals}</p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
