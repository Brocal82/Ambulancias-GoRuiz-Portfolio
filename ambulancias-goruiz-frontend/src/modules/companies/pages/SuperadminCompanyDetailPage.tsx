import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteCompany,
  getCompanyMetrics,
  getCompanySummary,
  getCompanyUsers,
} from "../domain/api";
import type { CompanyMetrics, CompanySummary, CompanyUserListItem } from "../domain/types";
import {
  ALL_MODULE_KEYS,
  MODULE_DISPLAY_GROUPS,
  MODULE_ICONS,
  MODULE_LABELS,
  type ModuleKey,
} from "../../../constants/modules";
import StatusBadge from "../../../components/common/StatusBadge";
import EditIconButton from "../../../components/common/actions/EditIconButton";
import CreateAdminIconButton from "../../../components/common/actions/CreateAdminIconButton";
import DangerDeleteButton from "../../../components/common/actions/DangerDeleteButton";
import { APP_NAV_MATCH_TABLE_THEAD } from "../../../components/ui/appTableHeader";
import { useStepUpSession } from "../utils/useStepUpSession";
import { toastT, getApiErrorMessage } from "../../../utils/toast";

const TAB_KEYS = ["overview", "users", "modules", "metrics", "security"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(value: string | null): value is TabKey {
  return value != null && (TAB_KEYS as readonly string[]).includes(value);
}

function ModulesOverviewSection({
  enabledModules,
  onEdit,
}: {
  enabledModules: string[];
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const enabledSet = useMemo(() => new Set(enabledModules), [enabledModules]);
  const activeCount = ALL_MODULE_KEYS.filter((key) => enabledSet.has(key)).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t("pages.superadminCompanyDetail.modulesTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {t("pages.superadminCompanyDetail.modulesSummary", {
              active: activeCount,
              total: ALL_MODULE_KEYS.length,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {t("pages.superadminCompanyDetail.editModules")}
        </button>
      </div>

      <div className="space-y-5 p-4">
        {activeCount === 0 && (
          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 text-center text-sm text-amber-900">
            {t("pages.superadminCompanyDetail.noModules")}
          </div>
        )}

        {MODULE_DISPLAY_GROUPS.map((group) => (
          <div key={group.id}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-orange-600">
              {t(`pages.superadminCompanyDetail.moduleGroup.${group.id}`)}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {group.keys.map((key) => {
                const enabled = enabledSet.has(key);
                const label = MODULE_LABELS[key as ModuleKey] ?? key;
                return (
                  <div
                    key={key}
                    className={`rounded-lg border px-2.5 py-2 transition ${
                      enabled
                        ? "border-orange-300 bg-white shadow-sm"
                        : "border-slate-100 bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-lg leading-none" aria-hidden>
                        {MODULE_ICONS[key as ModuleKey] ?? "🧩"}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${
                          enabled
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : "bg-slate-100 text-slate-500 ring-slate-200"
                        }`}
                      >
                        {enabled
                          ? t("pages.superadminCompanyDetail.moduleOn")
                          : t("pages.superadminCompanyDetail.moduleOff")}
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 text-[11px] font-medium leading-snug ${
                        enabled ? "text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SuperadminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [users, setUsers] = useState<CompanyUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { requestStepUpToken, stepUpModal } = useStepUpSession();

  const tabFromUrl = searchParams.get("tab");
  const activeTab: TabKey = isTabKey(tabFromUrl) ? tabFromUrl : "overview";

  const setActiveTab = (tab: TabKey) => {
    setSearchParams({ tab }, { replace: true });
  };

  const onboardingIncomplete = useMemo(() => {
    if (!summary) return false;
    return (
      !summary.onboarding.hasAdmin ||
      !summary.onboarding.hasWorker ||
      !summary.onboarding.hasModulesConfigured
    );
  }, [summary]);

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

  const roleColumns: Array<Array<{ key: string; count: number }>> = [
    [
      { key: "admin", count: summary.usersByRole.admin },
      { key: "mecanico", count: summary.usersByRole.mecanico },
      { key: "jefe_logistica", count: summary.usersByRole.jefe_logistica },
    ],
    [
      { key: "worker", count: summary.usersByRole.worker },
      { key: "jefe_mecanicos", count: summary.usersByRole.jefe_mecanicos },
    ],
  ];

  const onboardingColumns: Array<Array<{ key: string; ok: boolean; labelKey: string }>> = [
    [
      { key: "admin", ok: summary.onboarding.hasAdmin, labelKey: "onboardingAdmin" },
      { key: "worker", ok: summary.onboarding.hasWorker, labelKey: "onboardingWorker" },
    ],
    [
      {
        key: "modules",
        ok: summary.onboarding.hasModulesConfigured,
        labelKey: "onboardingModules",
      },
    ],
  ];

  const tabButtonClass = (isActive: boolean) =>
    `px-4 py-2 text-sm rounded-xl border transition focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-200/60 ${
      isActive
        ? "bg-blue-50 text-slate-900 border-orange-300 shadow-md"
        : "bg-white text-slate-700 border-transparent shadow hover:shadow-md hover:bg-blue-50 hover:border-orange-300"
    }`;

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

      {onboardingIncomplete && activeTab === "overview" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">{t("pages.superadminCompanyDetail.onboardingBannerTitle")}</p>
          <p className="mt-1">{t("pages.superadminCompanyDetail.onboardingBannerDesc")}</p>
        </div>
      )}

      <nav className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-slate-200 shadow-sm p-2">
        <div className="flex flex-wrap justify-center gap-2">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={tabButtonClass(activeTab === key)}
            >
              {t(`pages.superadminCompanyDetail.tabs.${key}`)}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              {t("pages.superadminCompanyDetail.onboardingTitle")}
            </h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-0">
              {onboardingColumns.map((column, columnIndex) => (
                <dl
                  key={columnIndex}
                  className={`min-w-0 flex-1 space-y-1 text-sm ${
                    columnIndex > 0
                      ? "sm:border-l sm:border-slate-200 sm:pl-10 lg:pl-14"
                      : "sm:pr-4"
                  }`}
                >
                  {column.map((item) => (
                    <div
                      key={item.key}
                      className="flex justify-between gap-6 border-b border-slate-100 py-1.5"
                    >
                      <dt className="text-slate-600">
                        {t(`pages.superadminCompanyDetail.${item.labelKey}`)}
                      </dt>
                      <dd
                        className={`font-medium tabular-nums ${
                          item.ok ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {item.ok
                          ? t("pages.superadminCompanyDetail.onboardingComplete")
                          : t("pages.superadminCompanyDetail.onboardingPending")}
                      </dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              {t("pages.superadminCompanyDetail.rolesTitle")}
            </h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-0">
              {roleColumns.map((column, columnIndex) => (
                <dl
                  key={columnIndex}
                  className={`min-w-0 flex-1 space-y-1 text-sm ${
                    columnIndex > 0
                      ? "sm:border-l sm:border-slate-200 sm:pl-10 lg:pl-14"
                      : "sm:pr-4"
                  }`}
                >
                  {column.map((r) => (
                    <div
                      key={r.key}
                      className="flex justify-between gap-6 border-b border-slate-100 py-1.5"
                    >
                      <dt className="text-slate-600">
                        {t(`pages.superadminCompanyDetail.role.${r.key}`)}
                      </dt>
                      <dd className="font-medium tabular-nums text-slate-900">{r.count}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "users" && (
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
      )}

      {activeTab === "modules" && (
        <ModulesOverviewSection
          enabledModules={summary.enabledModules}
          onEdit={() => navigate(`/superadmin/companies/${id}/edit`)}
        />
      )}

      {activeTab === "metrics" && metrics && (
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
              <p className="text-sm text-slate-500 mt-3">
                {t("pages.superadminCompanyDetail.metricsNone")}
              </p>
            )}
        </section>
      )}

      {activeTab === "security" && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">
            {t("pages.superadminCompanyDetail.securityTitle")}
          </h2>
          <p className="text-sm text-slate-600">{t("pages.superadminCompanyDetail.securityDesc")}</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                to={`/superadmin/security-monitoring?tenant=${encodeURIComponent(id)}`}
                className="text-blue-600 hover:underline"
              >
                {t("pages.superadminCompanyDetail.securityAuditLink")}
              </Link>
            </li>
            <li>
              <Link to="/superadmin/support-access" className="text-blue-600 hover:underline">
                {t("pages.superadminCompanyDetail.securitySupportLink")}
              </Link>
            </li>
            <li>
              <Link to="/superadmin/security-mfa" className="text-blue-600 hover:underline">
                {t("pages.superadminCompanyDetail.securityMfaLink")}
              </Link>
            </li>
          </ul>
          <p className="text-xs text-slate-500 font-mono">companyId: {id}</p>
        </section>
      )}

      {stepUpModal}
    </div>
  );
}
