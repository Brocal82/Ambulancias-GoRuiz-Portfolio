import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const SuperadminDashboard = () => {
  const { t } = useTranslation();

  const centeredCard =
    "bg-white p-6 rounded border border-transparent shadow hover:shadow-md hover:bg-blue-50 hover:border-orange-300 transition flex flex-col items-center text-center";

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
