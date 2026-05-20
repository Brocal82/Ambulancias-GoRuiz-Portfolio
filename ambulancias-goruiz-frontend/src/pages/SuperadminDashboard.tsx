import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGlobalSuperadminMetrics } from "../modules/companies/domain/api";
import type { GlobalSuperadminMetrics } from "../modules/companies/domain/types";
import { toastT, getApiErrorMessage } from "../utils/toast";

const SuperadminDashboard = () => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<GlobalSuperadminMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getGlobalSuperadminMetrics();
        if (!cancelled) setMetrics(data);
      } catch (e: unknown) {
        if (!cancelled) {
          toastT.error(getApiErrorMessage(e, t("pages.superadminDashboard.metricsLoadError")));
        }
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const centeredCard =
    "bg-white p-6 rounded border border-transparent shadow hover:shadow-md hover:bg-blue-50 hover:border-orange-300 transition flex flex-col items-center text-center";

  const kpiCard =
    "rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-center";

  const kpis = metrics
    ? [
        {
          label: t("pages.superadminDashboard.kpiCompaniesTotal"),
          value: metrics.companies.total,
          tone: "text-slate-900",
        },
        {
          label: t("pages.superadminDashboard.kpiCompaniesActive"),
          value: metrics.companies.active,
          tone: "text-emerald-700",
        },
        {
          label: t("pages.superadminDashboard.kpiCompaniesInactive"),
          value: metrics.companies.inactive,
          tone: "text-rose-700",
        },
        {
          label: t("pages.superadminDashboard.kpiOnboarding"),
          value: metrics.companies.needingOnboarding,
          tone:
            metrics.companies.needingOnboarding > 0 ? "text-amber-700" : "text-slate-900",
        },
        {
          label: t("pages.superadminDashboard.kpiUsersActive"),
          value: metrics.users.active,
          tone: "text-slate-900",
        },
        {
          label: t("pages.superadminDashboard.kpiWorkers"),
          value: metrics.users.workers,
          tone: "text-slate-900",
        },
        {
          label: t("pages.superadminDashboard.kpiAdmins"),
          value: metrics.users.admins,
          tone: "text-slate-900",
        },
      ]
    : [];

  return (
    <div>
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-center">
        <h1 className="text-2xl font-bold text-center text-slate-900">
          {t("pages.superadminDashboard.title")}
        </h1>
      </div>
      <p className="text-center text-slate-600 mb-8 max-w-xl mx-auto">
        {t("pages.superadminDashboard.subtitle")}
      </p>

      <section className="max-w-5xl mx-auto mb-10">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 text-center">
          {t("pages.superadminDashboard.metricsTitle")}
        </h2>
        {metricsLoading ? (
          <p className="text-center text-sm text-slate-500">
            {t("pages.superadminDashboard.metricsLoading")}
          </p>
        ) : metrics ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={kpiCard}>
                <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold tabular-nums ${kpi.tone}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <Link to="/superadmin/companies" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.superadminDashboard.manageCompanies")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.superadminDashboard.manageCompaniesDesc")}
          </p>
        </Link>

        <Link to="/superadmin/support-access" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.superadminDashboard.supportAccess")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.superadminDashboard.supportAccessDesc")}
          </p>
        </Link>

        <Link to="/superadmin/security-monitoring" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.superadminDashboard.securityMonitoring")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.superadminDashboard.securityMonitoringDesc")}
          </p>
        </Link>

        <Link to="/superadmin/security-mfa" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.superadminDashboard.mfa")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.superadminDashboard.mfaDesc")}
          </p>
        </Link>
      </div>
    </div>
  );
};

export default SuperadminDashboard;
