import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import StatusBadge from "../../../components/common/StatusBadge";
import { getPayrollReadiness } from "../domain/api";
import type { PayrollReadinessResponse } from "../domain/types";

export function PayrollReadinessPanel() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PayrollReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    void getPayrollReadiness()
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
      })
      .catch(() => {
        if (cancelled) return;
        setSummary(null);
        setError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5"
        data-testid="payroll-readiness-panel"
      >
        <p className="text-sm text-slate-600">
          {t("pages.payroll.readiness.loading")}
        </p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div
        className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5"
        data-testid="payroll-readiness-panel"
      >
        <p className="text-sm text-rose-700">
          {t("pages.payroll.readiness.loadError")}
        </p>
      </div>
    );
  }

  const isReady = summary.readiness === "READY";

  return (
    <div
      className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5"
      data-testid="payroll-readiness-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-slate-900">
          {t("pages.payroll.readiness.title")}
        </h2>
        <StatusBadge
          label={t(`pages.payroll.readiness.status.${summary.readiness}`)}
          tone={isReady ? "emerald" : "amber"}
        />
      </div>

      <dl className="space-y-2 text-sm text-slate-700">
        <div className="flex items-center justify-between gap-4">
          <dt>{t("pages.payroll.readiness.metrics.payrollWorkers")}</dt>
          <dd className="font-medium tabular-nums">{summary.payrollWorkers}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>{t("pages.payroll.readiness.metrics.missingEmployeeNumbers")}</dt>
          <dd className="font-medium tabular-nums">
            {summary.missingEmployeeNumbers}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>{t("pages.payroll.readiness.metrics.duplicateEmployeeNumbers")}</dt>
          <dd className="font-medium tabular-nums">
            {summary.duplicateEmployeeNumbers}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default PayrollReadinessPanel;
