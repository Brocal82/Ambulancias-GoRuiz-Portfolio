import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const SuperadminDashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        {t("pages.superadminDashboard.title")}
      </h1>
      <p className="text-slate-600 mb-6">
        {t("pages.superadminDashboard.subtitle")}
      </p>
      <button
        type="button"
        onClick={() => navigate("/superadmin/companies")}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        {t("pages.superadminDashboard.manageCompanies")}
      </button>
      <button
        type="button"
        onClick={() => navigate("/superadmin/security-monitoring")}
        className="ml-3 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        {t("pages.superadminDashboard.securityMonitoring")}
      </button>
    </div>
  );
};

export default SuperadminDashboard;
