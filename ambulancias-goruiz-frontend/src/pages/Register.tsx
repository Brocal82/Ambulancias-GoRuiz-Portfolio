import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicLayout from "../layouts/PublicLayout";

const Register = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <PublicLayout backTo="/" backLabel={t("pages.register.back")}>
      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur rounded-2xl shadow-lg border border-slate-800 p-8 text-center">
        <h2 className="text-2xl font-bold mb-6 text-white">
          {t("pages.register.title")}
        </h2>

        <p className="text-slate-300 mb-6 text-sm leading-relaxed">
          {t("pages.register.publicDisabled")}
        </p>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white shadow-sm
                     hover:bg-blue-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200
                     transition-all duration-200 ease-in-out"
        >
          {t("pages.register.goToLogin")}
        </button>
      </div>
    </PublicLayout>
  );
};

export default Register;
