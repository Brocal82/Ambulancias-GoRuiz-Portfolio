import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

const WINDOW_OPTIONS = [24, 48, 72, 168] as const;

type SupportCardKey =
  | "requested"
  | "denied"
  | "approvalRecorded"
  | "approvedFinal"
  | "revoked"
  | "expired"
  | "offHoursFinalApprovals";

const CARD_ACCENT: Record<SupportCardKey, string> = {
  requested: "border-l-slate-400",
  denied: "border-l-rose-500",
  approvalRecorded: "border-l-amber-400",
  approvedFinal: "border-l-emerald-500",
  revoked: "border-l-slate-300",
  expired: "border-l-slate-300",
  offHoursFinalApprovals: "border-l-amber-500",
};

const CARD_VALUE_TONE: Record<SupportCardKey, string> = {
  requested: "text-slate-900",
  denied: "text-rose-700",
  approvalRecorded: "text-amber-800",
  approvedFinal: "text-emerald-700",
  revoked: "text-slate-700",
  expired: "text-slate-700",
  offHoursFinalApprovals: "text-amber-800",
};

const MONTHLY_METRIC_KEYS = [
  "requested",
  "approvedFinal",
  "denied",
  "revoked",
  "expired",
  "offHoursFinalApprovals",
] as const;

function SectionPanel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const { t } = useTranslation();
  const normalized = outcome.toLowerCase();
  const styles =
    normalized === "success"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : normalized === "denied"
        ? "bg-rose-50 text-rose-800 ring-rose-200"
        : normalized === "error"
          ? "bg-amber-50 text-amber-900 ring-amber-200"
          : "bg-slate-100 text-slate-700 ring-slate-200";
  const label =
    normalized === "success" || normalized === "denied" || normalized === "error"
      ? t(`pages.superadminSecurityMonitoring.outcome.${normalized}`)
      : outcome;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const { t } = useTranslation();
  const styles =
    level === "high"
      ? "bg-rose-50 text-rose-800 ring-rose-200"
      : level === "medium"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-emerald-50 text-emerald-800 ring-emerald-200";
  const label = t(`pages.superadminSecurityMonitoring.riskLevel.${level}`, {
    defaultValue: level,
  });

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}

function StatusPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : tone === "bad"
          ? "bg-rose-50 text-rose-900 ring-rose-200"
          : "bg-slate-50 text-slate-800 ring-slate-200";

  return (
    <div className={`rounded-md px-2.5 py-1.5 ring-1 ring-inset ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-xs font-semibold">{value}</p>
    </div>
  );
}

function btnSecondaryClass(extra = "") {
  return `rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 ${extra}`.trim();
}

export default function SuperadminSecurityMonitoringPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tenantFromUrl = searchParams.get("tenant")?.trim() ?? "";
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
  const [tenantFilter, setTenantFilter] = useState<string>(tenantFromUrl);

  useEffect(() => {
    if (tenantFromUrl) setTenantFilter(tenantFromUrl);
  }, [tenantFromUrl]);

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
    const keys: SupportCardKey[] = [
      "requested",
      "denied",
      "approvalRecorded",
      "approvedFinal",
      "revoked",
      "expired",
      "offHoursFinalApprovals",
    ];
    return keys.map((key) => ({ key, value: s[key] }));
  }, [snapshot]);

  const hasActiveFilters =
    outcomeFilter !== "" || eventFilter !== "" || actorFilter !== "" || tenantFilter !== "";

  const healthBannerTone = useMemo(() => {
    if (!health || health.alerts.length === 0) return "ok" as const;
    if (health.alerts.some((a) => a.severity === "critical")) return "bad" as const;
    return "warn" as const;
  }, [health]);

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400";

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {t("pages.superadminSecurityMonitoring.title")}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t("pages.superadminSecurityMonitoring.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="monitoring-hours"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm"
          >
            <span className="text-xs font-medium text-slate-600">
              {t("pages.superadminSecurityMonitoring.windowLabel")}
            </span>
            <select
              id="monitoring-hours"
              className="rounded border-0 bg-transparent py-0 pl-0 pr-6 text-xs font-semibold text-slate-900 focus:ring-0"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t("pages.superadminSecurityMonitoring.hoursOption", { hours: option })}
                </option>
              ))}
            </select>
          </label>
          <Link to="/superadmin" className={btnSecondaryClass()}>
            {t("pages.superadminSecurityMonitoring.backToPanel")}
          </Link>
        </div>
      </header>

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
          {t("pages.superadminSecurityMonitoring.loading")}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {t("pages.superadminSecurityMonitoring.loadError")}: {error}
        </div>
      )}

      {!loading && !error && snapshot && (
        <>
          <SectionPanel
            title={t("pages.superadminSecurityMonitoring.operationalTitle")}
            description={t("pages.superadminSecurityMonitoring.sectionOperational")}
          >
            {healthLoading && (
              <p className="text-xs text-slate-600">
                {t("pages.superadminSecurityMonitoring.operationalLoading")}
              </p>
            )}
            {!healthLoading && healthError && (
              <p className="text-xs text-rose-700">
                {t("pages.superadminSecurityMonitoring.operationalError")}: {healthError}
              </p>
            )}
            {!healthLoading && !healthError && health && (
              <div className="space-y-2.5">
                <div
                  className={
                    healthBannerTone === "ok"
                      ? "rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900"
                      : healthBannerTone === "bad"
                        ? "rounded-md border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-900"
                        : "rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900"
                  }
                >
                  {health.alerts.length === 0
                    ? t("pages.superadminSecurityMonitoring.operationalNoAlerts")
                    : health.alerts.map((alert) => (
                        <p key={alert.code} className="leading-snug">
                          <span className="font-semibold">{alert.code}</span>
                          <span className="mx-1 text-slate-400">·</span>
                          {alert.message}
                        </p>
                      ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatusPill
                    label={t("pages.superadminSecurityMonitoring.operationalDb")}
                    value={
                      health.dbStatus === "ok"
                        ? t("pages.superadminSecurityMonitoring.dbOk")
                        : t("pages.superadminSecurityMonitoring.dbDown")
                    }
                    tone={health.dbStatus === "ok" ? "ok" : "bad"}
                  />
                  <StatusPill
                    label={t("pages.superadminSecurityMonitoring.operationalEnabled")}
                    value={
                      health.monitoringEnabled
                        ? t("pages.superadminSecurityMonitoring.enabledYes")
                        : t("pages.superadminSecurityMonitoring.enabledNo")
                    }
                    tone={health.monitoringEnabled ? "ok" : "bad"}
                  />
                  <StatusPill
                    label={t("pages.superadminSecurityMonitoring.operationalCron")}
                    value={health.monitoringCron}
                    tone="neutral"
                  />
                  <StatusPill
                    label={t("pages.superadminSecurityMonitoring.operationalLastReport")}
                    value={
                      health.lastDailyReportAt
                        ? new Date(health.lastDailyReportAt).toLocaleString()
                        : "—"
                    }
                    tone={health.staleDailyReport ? "warn" : "ok"}
                  />
                </div>
              </div>
            )}
          </SectionPanel>

          <SectionPanel
            title={t("pages.superadminSecurityMonitoring.sectionSupportAccess")}
            description={t("pages.superadminSecurityMonitoring.sectionSupportAccessDesc")}
            actions={
              <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                <div>
                  <dt className="inline font-medium">{t("pages.superadminSecurityMonitoring.generatedAt")}: </dt>
                  <dd className="inline">{new Date(snapshot.generatedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">{t("pages.superadminSecurityMonitoring.deniedThreshold")}: </dt>
                  <dd className="inline">{snapshot.deniedThreshold}</dd>
                </div>
              </dl>
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {cards.map((card) => (
                <div
                  key={card.key}
                  className={`rounded-md border border-slate-100 bg-slate-50/50 border-l-4 px-2.5 py-2 ${CARD_ACCENT[card.key]}`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 leading-tight">
                    {t(`pages.superadminSecurityMonitoring.cards.${card.key}`)}
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold tabular-nums ${CARD_VALUE_TONE[card.key]}`}
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              <span className="font-medium">{t("pages.superadminSecurityMonitoring.range")}: </span>
              {new Date(snapshot.supportAccess.since).toLocaleString()} —{" "}
              {new Date(snapshot.supportAccess.until).toLocaleString()}
            </p>
          </SectionPanel>

          <div className="grid gap-3 lg:grid-cols-2">
            <SectionPanel title={t("pages.superadminSecurityMonitoring.monthlyReviewTitle")}>
              {monthlyReviewLoading && (
                <p className="text-xs text-slate-600">
                  {t("pages.superadminSecurityMonitoring.monthlyReviewLoading")}
                </p>
              )}
              {!monthlyReviewLoading && monthlyReviewError && (
                <p className="text-xs text-rose-700">
                  {t("pages.superadminSecurityMonitoring.monthlyReviewError")}: {monthlyReviewError}
                </p>
              )}
              {!monthlyReviewLoading && !monthlyReviewError && monthlyReview && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">
                      {t("pages.superadminSecurityMonitoring.monthlyReviewStatus")}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
                      {monthlyReview.overallStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {MONTHLY_METRIC_KEYS.map((key) => (
                      <div
                        key={key}
                        className="rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5"
                      >
                        <p className="text-[10px] text-slate-500">
                          {t(`pages.superadminSecurityMonitoring.cards.${key}`)}
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">
                          {monthlyReview.metrics[key]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionPanel>

            <SectionPanel
              title={t("pages.superadminSecurityMonitoring.tenantRiskTitle")}
              actions={
                <button
                  type="button"
                  className={btnSecondaryClass()}
                  onClick={() =>
                    exportCsv(
                      "tenant-risk.csv",
                      [
                        "tenantCompanyId",
                        "riskLevel",
                        "riskScore",
                        "requested",
                        "denied",
                        "offHoursFinalApprovals",
                      ],
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
              }
            >
              {tenantRiskLoading && (
                <p className="text-xs text-slate-600">
                  {t("pages.superadminSecurityMonitoring.tenantRiskLoading")}
                </p>
              )}
              {!tenantRiskLoading && tenantRiskError && (
                <p className="text-xs text-rose-700">
                  {t("pages.superadminSecurityMonitoring.tenantRiskError")}: {tenantRiskError}
                </p>
              )}
              {!tenantRiskLoading && !tenantRiskError && (
                <div className="max-h-64 overflow-auto rounded-md border border-slate-100">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">
                          {t("pages.superadminSecurityMonitoring.tenantRiskTable.tenant")}
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium">
                          {t("pages.superadminSecurityMonitoring.tenantRiskTable.level")}
                        </th>
                        <th className="px-2 py-1.5 text-right font-medium">
                          {t("pages.superadminSecurityMonitoring.tenantRiskTable.score")}
                        </th>
                        <th className="px-2 py-1.5 text-right font-medium">
                          {t("pages.superadminSecurityMonitoring.tenantRiskTable.denied")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tenantRiskRows.map((row) => (
                        <tr key={row.tenantCompanyId} className="hover:bg-slate-50/80">
                          <td className="px-2 py-1.5 font-mono text-[11px]">
                            <Link
                              to={`/superadmin/companies/${row.tenantCompanyId}?tab=security`}
                              className="text-orange-700 hover:underline"
                              title={t("pages.superadminSecurityMonitoring.viewCompany")}
                            >
                              {row.tenantCompanyId.slice(-8)}
                            </Link>
                          </td>
                          <td className="px-2 py-1.5">
                            <RiskBadge level={row.riskLevel} />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                            {row.riskScore}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-rose-700">
                            {row.denied}
                          </td>
                        </tr>
                      ))}
                      {tenantRiskRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-slate-500">
                            {t("pages.superadminSecurityMonitoring.tenantRiskEmpty")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionPanel>
          </div>

          <SectionPanel
            title={t("pages.superadminSecurityMonitoring.auditTitle")}
            description={t("pages.superadminSecurityMonitoring.auditTotal", { total: auditTotal })}
            actions={
              <button
                type="button"
                className={btnSecondaryClass()}
                onClick={() =>
                  exportCsv(
                    "security-audit-logs.csv",
                    [
                      "at",
                      "event",
                      "outcome",
                      "actorUserId",
                      "tenantCompanyId",
                      "resourceType",
                      "resourceId",
                      "reason",
                    ],
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
            }
          >
            <div className="mb-2 flex flex-wrap items-end gap-2">
              <select
                className={`${inputClass} max-w-[140px]`}
                value={outcomeFilter}
                onChange={(e) =>
                  setOutcomeFilter(e.target.value as "" | "success" | "denied" | "error")
                }
              >
                <option value="">{t("pages.superadminSecurityMonitoring.filters.outcomeAny")}</option>
                <option value="success">
                  {t("pages.superadminSecurityMonitoring.filters.outcomeSuccess")}
                </option>
                <option value="denied">
                  {t("pages.superadminSecurityMonitoring.filters.outcomeDenied")}
                </option>
                <option value="error">
                  {t("pages.superadminSecurityMonitoring.filters.outcomeError")}
                </option>
              </select>
              <input
                className={`${inputClass} min-w-[120px] flex-1`}
                placeholder={t("pages.superadminSecurityMonitoring.filters.eventPlaceholder")}
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
              />
              <input
                className={`${inputClass} min-w-[100px] flex-1`}
                placeholder={t("pages.superadminSecurityMonitoring.filters.actorPlaceholder")}
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              />
              <input
                className={`${inputClass} min-w-[100px] flex-1`}
                placeholder={t("pages.superadminSecurityMonitoring.filters.tenantPlaceholder")}
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
              />
              {hasActiveFilters && (
                <button
                  type="button"
                  className={btnSecondaryClass()}
                  onClick={() => {
                    setOutcomeFilter("");
                    setEventFilter("");
                    setActorFilter("");
                    setTenantFilter(tenantFromUrl);
                  }}
                >
                  {t("pages.superadminSecurityMonitoring.clearFilters")}
                </button>
              )}
            </div>

            {auditLoading && (
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-6 text-center text-xs text-slate-600">
                {t("pages.superadminSecurityMonitoring.auditLoading")}
              </div>
            )}
            {!auditLoading && auditError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {t("pages.superadminSecurityMonitoring.auditError")}: {auditError}
              </div>
            )}
            {!auditLoading && !auditError && (
              <div className="max-h-[420px] overflow-auto rounded-md border border-slate-100">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">
                        {t("pages.superadminSecurityMonitoring.table.at")}
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium">
                        {t("pages.superadminSecurityMonitoring.table.event")}
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium">
                        {t("pages.superadminSecurityMonitoring.table.outcome")}
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium hidden md:table-cell">
                        {t("pages.superadminSecurityMonitoring.table.actor")}
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium hidden lg:table-cell">
                        {t("pages.superadminSecurityMonitoring.table.tenant")}
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium hidden xl:table-cell">
                        {t("pages.superadminSecurityMonitoring.table.resource")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditRows.map((row) => (
                      <tr key={row._id} className="hover:bg-orange-50/30">
                        <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                          {new Date(row.at).toLocaleString()}
                        </td>
                        <td className="max-w-[200px] truncate px-2 py-1.5 font-mono text-[11px] text-slate-800">
                          {row.event}
                        </td>
                        <td className="px-2 py-1.5">
                          <OutcomeBadge outcome={row.outcome} />
                        </td>
                        <td className="hidden max-w-[120px] truncate px-2 py-1.5 font-mono text-[11px] md:table-cell">
                          {row.actorUserId ?? "—"}
                        </td>
                        <td className="hidden px-2 py-1.5 font-mono text-[11px] lg:table-cell">
                          {row.tenantCompanyId ? (
                            <Link
                              to={`/superadmin/companies/${row.tenantCompanyId}?tab=security`}
                              className="text-orange-700 hover:underline"
                            >
                              {row.tenantCompanyId.slice(-8)}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="hidden max-w-[140px] truncate px-2 py-1.5 text-slate-600 xl:table-cell">
                          {[row.resourceType, row.resourceId].filter(Boolean).join(":") || "—"}
                        </td>
                      </tr>
                    ))}
                    {auditRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-6 text-center text-slate-500">
                          {t("pages.superadminSecurityMonitoring.table.empty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionPanel>
        </>
      )}
    </div>
  );
}
