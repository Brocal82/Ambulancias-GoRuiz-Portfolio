//frontend/src/pages/WorkerDashboard.tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useUnreadMessagesCount } from "../hooks/useUnreadMessagesCount";

const WorkerDashboard = () => {
  const { t } = useTranslation();
  const { count: unreadMessages } = useUnreadMessagesCount({ pollMs: 30000 });

  // justo encima del return, dentro del componente
  const centeredCard =
    "bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition flex flex-col items-center text-center";
  const centeredCardRelative = `relative ${centeredCard}`;
  const centeredCardDisabled =
    "bg-white p-6 rounded shadow opacity-50 cursor-not-allowed flex flex-col items-center text-center";

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

        <Link to="/worker/praemien" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.praemien.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.praemien.desc")}
          </p>
        </Link>

        <Link to="/worker/hospitals" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.hospitals.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.hospitals.desc")}
          </p>
        </Link>

        {/* MENSAJES con borde + contador (sin campana) */}
        <Link
          to="/worker/messages"
          className={`${centeredCardRelative} ${
            unreadMessages > 0 ? "ring-2 ring-orange-300" : ""
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

        <Link to="/worker/vacations" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.vacations.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.vacations.desc")}
          </p>
        </Link>

        <Link to="/worker/sick-leaves" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.sickLeaves.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.sickLeaves.desc")}
          </p>
        </Link>

        <Link to="/worker/appointments" className={centeredCard}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.appointments.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.appointments.desc")}
          </p>
        </Link>

        <div className={centeredCardDisabled}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.payrollDocs.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.payrollDocs.desc")}
          </p>
        </div>

        <div className={centeredCardDisabled}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.game.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.game.desc")}
          </p>
        </div>

        <div className={centeredCardDisabled}>
          <h2 className="text-lg font-semibold mb-2">
            {t("pages.workerDashboard.clothes.title")}
          </h2>
          <p className="text-sm text-gray-600">
            {t("pages.workerDashboard.clothes.desc")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;
