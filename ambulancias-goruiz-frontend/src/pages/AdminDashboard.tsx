//frontend/src/pages/AdminDashboard.tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

// ? Hook para contador de pendientes de Vacaciones
import useAdminVacationsPendingCount from "../modules/vacation/hooks/useAdminVacationsPendingCount";
import useAdminSummariesPendingCount from "../modules/workday/hooks/useAdminSummariesPendingCount";
import { useAdminAppointmentsPendingCount } from "../modules/appointments";
import { useAdminIssuesOpenCount } from "../modules/mechanics";
import useAdminSickLeavesPendingCount from "../modules/sick/hooks/useAdminSickLeavesPendingCount";
import useAdminManualPraemiePendingCount from "../modules/praemien/hooks/useAdminManualPraemiePendingCount";
import { useModules } from "../hooks/useModules";
import { MODULE_KEYS } from "../constants/modules";

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { hasModule } = useModules();

  // ? Contador de solicitudes de vacaciones pendientes
  const { count: vacationsPendingCount, isLoading: vacationsLoading } =
    useAdminVacationsPendingCount({
      skip: !hasModule(MODULE_KEYS.VACATION),
    });
  const vacationsHasPending = !vacationsLoading && vacationsPendingCount > 0;

  //  Contador de resúmenes pendientes
  const { count: summariesPendingCount, isLoading: summariesLoading } =
    useAdminSummariesPendingCount();
  const summariesHasPending = !summariesLoading && summariesPendingCount > 0;

  const { count: apptPending, isLoading: apptLoading } =
    useAdminAppointmentsPendingCount({ skip: !hasModule(MODULE_KEYS.APPOINTMENTS) });
  const apptHasPending = !apptLoading && apptPending > 0;

  const { count: issuesOpenCount, isLoading: issuesLoading } =
    useAdminIssuesOpenCount({
      skip: !hasModule(MODULE_KEYS.MECHANICS),
    });
  const issuesHasOpen = !issuesLoading && issuesOpenCount > 0;

  const { count: sickPendingCount, isLoading: sickLoading } =
    useAdminSickLeavesPendingCount({
      skip: !hasModule(MODULE_KEYS.SICK_LEAVES),
    });
  const sickHasPending = !sickLoading && sickPendingCount > 0;

  const { count: praemienManualPending, isLoading: praemienManualLoading } =
    useAdminManualPraemiePendingCount({
      skip: !hasModule(MODULE_KEYS.PRAEMIEN),
    });
  const praemienManualHasPending =
    !praemienManualLoading && praemienManualPending > 0;

  // justo encima del return, dentro del componente
  const centeredCard =
    "bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition flex flex-col items-center text-center";
  const centeredCardRelative = `relative ${centeredCard}`;
  const centeredCardDisabled =
    "bg-slate-100 p-6 rounded shadow-sm opacity-75 cursor-not-allowed pointer-events-none select-none flex flex-col items-center text-center border border-slate-200";

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header centrado */}
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-center">
        <h1 className="text-2xl font-bold text-center">
          {t("pages.adminDashboard.title")}
        </h1>
      </div>

      {/* Grid de tarjetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <Link to="/admin/users" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.adminDashboard.users.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.adminDashboard.users.desc")}
          </p>
        </Link>

        <Link to="/admin/invitations" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.adminDashboard.invitations.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.adminDashboard.invitations.desc")}
          </p>
        </Link>

        <Link to="/admin/teams" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.adminDashboard.teams.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.adminDashboard.teams.desc")}
          </p>
        </Link>

        <Link to="/admin/diensts" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.adminDashboard.diensts.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.adminDashboard.diensts.desc")}
          </p>
        </Link>

        <Link to="/admin/dienst-templates" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.adminDashboard.dienstTemplates.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.adminDashboard.dienstTemplates.desc")}
          </p>
        </Link>

        <Link
          to="/admin/summaries"
          className={`${centeredCardRelative} ${summariesHasPending ? "ring-2 ring-orange-300" : ""}`}
          aria-label={
            summariesHasPending
              ? t("pages.adminDashboard.summaries.title") +
              ` (${summariesPendingCount})`
              : t("pages.adminDashboard.summaries.title")
          }
        >
          {!summariesLoading && summariesPendingCount > 0 && (
            <span
              className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-orange-400 text-white text-xs font-semibold h-6 min-w-6 px-2 shadow"
              aria-label={`${summariesPendingCount} ${t("pages.adminDashboard.summaries.pending") ?? "pendientes"}`}
            >
              {summariesPendingCount}
            </span>
          )}

          <h2 className="text-lg font-semibold mb-2">
            {t("pages.adminDashboard.summaries.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.adminDashboard.summaries.desc")}
          </p>
        </Link>

        {hasModule(MODULE_KEYS.PRAEMIEN) && (
          <Link
            to="/admin/users?praemienPending=1"
            className={`${centeredCardRelative} ${praemienManualHasPending ? "ring-2 ring-orange-300" : ""}`}
            aria-label={
              praemienManualHasPending
                ? t("pages.adminDashboard.praemien.title") +
                  ` (${praemienManualPending})`
                : t("pages.adminDashboard.praemien.title")
            }
          >
            {!praemienManualLoading && praemienManualPending > 0 && (
              <span
                className="absolute -top-2 -right-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-400 px-2 text-xs font-semibold text-white shadow"
                aria-label={`${praemienManualPending} ${t("pages.adminDashboard.praemien.pending")}`}
              >
                {praemienManualPending}
              </span>
            )}

            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.praemien.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.praemien.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.HOSPITALS) && (
          <Link to="/admin/hospitals" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.hospitals.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.hospitals.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.AMBULANCES) && (
          <Link to="/admin/ambulances" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.ambulances.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.ambulances.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.MECHANICS) && (
          <Link
            to="/admin/mechanics"
            className={`${centeredCardRelative} ${issuesHasOpen ? "ring-2 ring-red-300" : ""}`}
          >
            {!issuesLoading && issuesHasOpen && (
              <span className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center shadow">
                {issuesOpenCount}
              </span>
            )}

            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.mechanics.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.mechanics.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.VACATION) && (
          <Link
            to="/admin/vacations"
            className={`${centeredCardRelative} ${vacationsHasPending ? "ring-2 ring-orange-300" : ""}`}
            aria-label={
              vacationsHasPending
                ? t("pages.adminDashboard.vacations.title") +
                ` (${vacationsPendingCount})`
                : t("pages.adminDashboard.vacations.title")
            }
          >
            {!vacationsLoading && vacationsPendingCount > 0 && (
              <span
                className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-semibold h-6 min-w-6 px-2 shadow"
                aria-label={`${vacationsPendingCount} ${t("pages.adminDashboard.vacations.pending") ?? "pendientes"}`}
              >
                {vacationsPendingCount}
              </span>
            )}

            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.vacations.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.vacations.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.SICK_LEAVES) && (
          <Link
            to="/admin/sick-leaves"
            className={`${centeredCardRelative} ${sickHasPending ? "ring-2 ring-orange-300" : ""}`}
            aria-label={
              sickHasPending
                ? t("pages.adminDashboard.sickLeaves.title") +
                ` (${sickPendingCount})`
                : t("pages.adminDashboard.sickLeaves.title")
            }
          >
            {!sickLoading && sickPendingCount > 0 && (
              <span
                className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-semibold h-6 min-w-6 px-2 shadow"
                aria-label={`${sickPendingCount} ${t("pages.adminDashboard.sickLeaves.pending") ?? "pendientes"}`}
              >
                {sickPendingCount}
              </span>
            )}

            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.sickLeaves.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.sickLeaves.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.APPOINTMENTS) && (
          <Link
            to="/admin/appointments"
            className={`${centeredCardRelative} ${apptHasPending ? "ring-2 ring-orange-300" : ""}`}
          >
            {!apptLoading && apptHasPending && (
              <span className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-2 rounded-full bg-orange-500 text-white text-xs font-semibold flex items-center justify-center shadow">
                {apptPending}
              </span>
            )}

            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.appointments.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.appointments.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.MESSAGES) && (
          <Link to="/admin/messages" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.messages.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.messages.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.PAYROLL) && (
          <Link to="/admin/payroll" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.adminDashboard.payrollDocs.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.adminDashboard.payrollDocs.desc")}
            </p>
          </Link>
        )}

        <div className={centeredCardDisabled}>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            {t("common.comingSoon")}
          </span>
          <h2 className="text-lg font-semibold mb-2 text-slate-600">
            {t("pages.adminDashboard.clothes.title")}
          </h2>
          <p className="text-sm text-slate-500">
            {t("pages.adminDashboard.clothes.desc")}
          </p>
        </div>

        <div className={centeredCardDisabled}>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            {t("common.comingSoon")}
          </span>
          <h2 className="text-lg font-semibold mb-2 text-slate-600">
            {t("pages.adminDashboard.formation.title")}
          </h2>
          <p className="text-sm text-slate-500">
            {t("pages.adminDashboard.formation.desc")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;


