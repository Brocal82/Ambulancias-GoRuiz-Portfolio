//frontend/src/pages/WorkerDashboard.tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useUnreadMessagesCount } from "../modules/messages/hooks/useUnreadMessagesCount";
import { useModules } from "../hooks/useModules";
import { MODULE_KEYS } from "../constants/modules";

const WorkerDashboard = () => {
  const { t } = useTranslation();
  const { hasModule } = useModules();
  const { count: unreadMessages } = useUnreadMessagesCount({
    pollMs: 30000,
    skip: !hasModule(MODULE_KEYS.MESSAGES),
  });

  // justo encima del return, dentro del componente
  const centeredCard =
    "bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition flex flex-col items-center text-center";
  const centeredCardRelative = `relative ${centeredCard}`;
  const centeredCardDisabled =
    "bg-slate-100 p-6 rounded shadow-sm opacity-75 cursor-not-allowed pointer-events-none select-none flex flex-col items-center text-center border border-slate-200";

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {t("pages.workerDashboard.title")}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <Link to="/profile" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.profile.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.profile.desc")}
          </p>
        </Link>

        <Link to="/dienst" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.dienst.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.dienst.desc")}
          </p>
        </Link>

        <Link to="/my-workday" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.workday.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.workday.desc")}
          </p>
        </Link>

        {hasModule(MODULE_KEYS.MECHANICS) && (
          <Link to="/worker/report-issue" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.mechanics.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.mechanics.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.PRAEMIEN) && (
          <Link to="/worker/praemien" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.praemien.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.praemien.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.HOSPITALS) && (
          <Link to="/worker/hospitals" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.hospitals.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.hospitals.desc")}
            </p>
          </Link>
        )}

        {/* MENSAJES con borde + contador (sin campana) */}
        {hasModule(MODULE_KEYS.MESSAGES) && (
          <Link
            to="/worker/messages"
            className={`${centeredCardRelative} ${unreadMessages > 0 ? "ring-2 ring-orange-300" : ""
              }`}
            aria-label={
              unreadMessages > 0
                ? `${t("pages.workerDashboard.messages.title")} (${unreadMessages} sin leer)`
                : t("pages.workerDashboard.messages.title")
            }
          >
            {unreadMessages > 0 && (
              <span
                className="absolute right-3 top-3 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-orange-400 px-1.5 text-xs font-semibold text-white shadow-lg"
                aria-hidden="true"
              >
                {unreadMessages}
              </span>
            )}
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.messages.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.messages.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.VACATION) && (
          <Link to="/worker/vacations" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.vacations.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.vacations.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.SICK_LEAVES) && (
          <Link to="/worker/sick-leaves" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.sickLeaves.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.sickLeaves.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.APPOINTMENTS) && (
          <Link to="/worker/appointments" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.appointments.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.appointments.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.PAYROLL) && (
          <Link to="/worker/payroll" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.payrollDocs.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.payrollDocs.desc")}
            </p>
          </Link>
        )}

        {hasModule(MODULE_KEYS.DOCUMENTS) && (
          <Link to="/worker/documents" className={centeredCard}>
            <h2 className="text-lg font-semibold mb-2">
              {t("pages.workerDashboard.companyDocuments.title")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("pages.workerDashboard.companyDocuments.desc")}
            </p>
          </Link>
        )}

        <div className={centeredCardDisabled}>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            {t("common.comingSoon")}
          </span>
          <h2 className="text-lg font-semibold mb-2 text-slate-600">
            {t("pages.workerDashboard.game.title")}
          </h2>
          <p className="text-sm text-slate-500">
            {t("pages.workerDashboard.game.desc")}
          </p>
        </div>

        <div className={centeredCardDisabled}>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            {t("common.comingSoon")}
          </span>
          <h2 className="text-lg font-semibold mb-2 text-slate-600">
            {t("pages.workerDashboard.clothes.title")}
          </h2>
          <p className="text-sm text-slate-500">
            {t("pages.workerDashboard.clothes.desc")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;
