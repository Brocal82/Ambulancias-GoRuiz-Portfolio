import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteCompany,
  getCompanyMetrics,
  getCompanySummary,
  getCompanyUsers,
} from "../domain/api";
import type { CompanyMetrics, CompanySummary, CompanyUserListItem } from "../domain/types";
import { MODULE_LABELS } from "../../../constants/modules";
import StatusBadge from "../../../components/common/StatusBadge";
import EditIconButton from "../../../components/common/actions/EditIconButton";
import CreateAdminIconButton from "../../../components/common/actions/CreateAdminIconButton";
import DangerDeleteButton from "../../../components/common/actions/DangerDeleteButton";
import { APP_NAV_MATCH_TABLE_THEAD } from "../../../components/ui/appTableHeader";
import { useStepUpSession } from "../utils/useStepUpSession";
import { toastT, getApiErrorMessage } from "../../../utils/toast";

function OnboardingCheck({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2 text-sm text-slate-700">
      <span className={ok ? "text-emerald-600" : "text-slate-400"}>
        {ok ? "✓" : "○"}
      </span>
      {label}
    </li>
  );
}

export default function SuperadminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [users, setUsers] = useState<CompanyUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { requestStepUpToken, stepUpModal } = useStepUpSession();

  const reload = async () => {
    if (!id) return;
    const [s, u, m] = await Promise.all([
      getCompanySummary(id),
      getCompanyUsers(id, { limit: 100 }),
      getCompanyMetrics(id),
    ]);
    setSummary(s);
    setUsers(u.users);
    setMetrics(m);
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, u, m] = await Promise.all([
          getCompanySummary(id),
          getCompanyUsers(id, { limit: 100 }),
          getCompanyMetrics(id),
        ]);
        if (!cancelled) {
          setSummary(s);
          setUsers(u.users);
          setMetrics(m);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          toastT.error(getApiErrorMessage(e, t("pages.superadminCompanyDetail.loadError")));
          navigate("/superadmin/companies");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, t]);

  const handleArchive = async () => {
    if (!id || !summary) return;
    if (!window.confirm(t("pages.superadminCompanyDetail.archiveConfirm", { name: summary.name }))) {
      return;
    }
    try {
      const stepUpToken = await requestStepUpToken(
        t("pages.superadminCompanyDetail.archiveStepUp"),
      );
      if (!stepUpToken) return;
      await deleteCompany(id, stepUpToken);
      toastT.success(t("pages.superadminCompanyDetail.archiveSuccess"));
      navigate("/superadmin/companies");
    } catch (e: unknown) {
      toastT.error(getApiErrorMessage(e, t("pages.superadminCompanyDetail.archiveError")));
    }
  };

  if (!id) {
    return <p className="text-red-600">{t("pages.superadminCompanyDetail.missingId")}</p>;
  }

  if (loading) {
    return <p className="text-slate-600">{t("pages.superadminCompanyDetail.loading")}</p>;
  }

  if (!summary) {
    return null;
  }

  const roleRows = [
    { key: "admin", count: summary.usersByRole.admin },
    { key: "worker", count: summary.usersByRole.worker },
    { key: "mecanico", count: summary.usersByRole.mecanico },
    { key: "jefe_mecanicos", count: summary.usersByRole.jefe_mecanicos },
    { key: "jefe_logistica", count: summary.usersByRole.jefe_logistica },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/superadmin/companies"
            className="text-sm text-slate-600 hover:text-slate-900 underline mb-2 inline-block"
          >
            {t("pages.superadminCompanyDetail.backToList")}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{summary.name}</h1>
          <p className="text-sm text-slate-500 mt-1 font-mono">{summary.emailDomain}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <StatusBadge
              label={
                summary.isActive
                  ? t("pages.superadminCompanyDetail.active")
                  : t("pages.superadminCompanyDetail.inactive")
              }
              tone={summary.isActive ? "emerald" : "rose"}
            />
            <StatusBadge
              label={t("pages.superadminCompanyDetail.modulesCount", {
                count: summary.enabledModulesCount,
              })}
              tone="sky"
            />
            <StatusBadge
              label={t("pages.superadminCompanyDetail.usersTotal", {
                count: summary.usersByRole.total,
              })}
              tone="slate"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditIconButton
            onClick={() => navigate(`/superadmin/companies/${id}/edit`)}
            title={t("pages.superadminCompanyDetail.edit")}
          />
          <CreateAdminIconButton
            onClick={() => navigate(`/superadmin/companies/${id}/admin`)}
            title={t("pages.superadminCompanyDetail.createAdmin")}
          />
          <DangerDeleteButton
            onClick={() => void handleArchive()}
            title={t("pages.superadminCompanyDetail.archive")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            {t("pages.superadminCompanyDetail.onboardingTitle")}
          </h2>
          <ul className="space-y-1">
            <OnboardingCheck
              ok={summary.onboarding.hasAdmin}
              label={t("pages.superadminCompanyDetail.onboardingAdmin")}
            />
            <OnboardingCheck
              ok={summary.onboarding.hasWorker}
              label={t("pages.superadminCompanyDetail.onboardingWorker")}
            />
            <OnboardingCheck
              ok={summary.onboarding.hasModulesConfigured}
              label={t("pages.superadminCompanyDetail.onboardingModules")}
            />
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            {t("pages.superadminCompanyDetail.rolesTitle")}
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {roleRows.map((r) => (
              <div key={r.key} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                <dt className="text-slate-600">{t(`pages.superadminCompanyDetail.role.${r.key}`)}</dt>
                <dd className="font-medium text-slate-900">{r.count}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {metrics && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            {t("pages.superadminCompanyDetail.metricsTitle")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {metrics.modules.scheduling != null && (
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">{t("pages.superadminCompanyDetail.metricDiensts")}</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">
                  {metrics.modules.scheduling.diensts}
                </p>
              </div>
            )}
            {metrics.modules.workday != null && (
              <>
                <div className="rounded border border-slate-100 bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-500">{t("pages.superadminCompanyDetail.metricTrips")}</p>
                  <p className="text-xl font-bold text-slate-900 tabular-nums">
                    {metrics.modules.workday.trips}
                  </p>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-500">
                    {t("pages.superadminCompanyDetail.metricClosures")}
                  </p>
                  <p className="text-xl font-bold text-slate-900 tabular-nums">
                    {metrics.modules.workday.finalClosures}
                  </p>
                </div>
              </>
            )}
            {metrics.modules.vacation != null && (
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">
                  {t("pages.superadminCompanyDetail.metricVacationPending")}
                </p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    metrics.modules.vacation.pending > 0 ? "text-amber-700" : "text-slate-900"
                  }`}
                >
                  {metrics.modules.vacation.pending}
                </p>
              </div>
            )}
            {metrics.modules.mechanics != null && (
              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">
                  {t("pages.superadminCompanyDetail.metricMechanicsOpen")}
                </p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    metrics.modules.mechanics.openIssues > 0 ? "text-rose-700" : "text-slate-900"
                  }`}
                >
                  {metrics.modules.mechanics.openIssues}
                </p>
              </div>
            )}
          </div>
          {metrics.modules.scheduling == null &&
            metrics.modules.workday == null &&
            metrics.modules.vacation == null &&
            metrics.modules.mechanics == null && (
              <p className="text-sm text-slate-500">{t("pages.superadminCompanyDetail.metricsNone")}</p>
            )}
        </section>
      )}

      {summary.enabledModules.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">
            {t("pages.superadminCompanyDetail.modulesTitle")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {summary.enabledModules.map((key) => (
              <span
                key={key}
                className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
              >
                {MODULE_LABELS[key as keyof typeof MODULE_LABELS] ?? key}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            {t("pages.superadminCompanyDetail.usersTitle")}
          </h2>
          <button
            type="button"
            onClick={() => void reload()}
            className="text-xs text-blue-600 hover:underline"
          >
            {t("pages.superadminCompanyDetail.refresh")}
          </button>
        </div>
        {users.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">{t("pages.superadminCompanyDetail.noUsers")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={`${APP_NAV_MATCH_TABLE_THEAD} text-left text-slate-200`}>
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("pages.superadminCompanyDetail.colName")}</th>
                  <th className="px-4 py-3 font-semibold">{t("pages.superadminCompanyDetail.colEmail")}</th>
                  <th className="px-4 py-3 font-semibold">{t("pages.superadminCompanyDetail.colRole")}</th>
                  <th className="px-4 py-3 font-semibold text-center">{t("pages.superadminCompanyDetail.colActive")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-900">
                      {u.name} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-slate-700">{u.role}</td>
                    <td className="px-4 py-3 text-center">
                      {u.isActive ? "✅" : "❌"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {stepUpModal}
    </div>
  );
}
