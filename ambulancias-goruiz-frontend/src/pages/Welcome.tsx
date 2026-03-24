import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicLayout from "../layouts/PublicLayout";

export default function Welcome() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <PublicLayout showBack={false}>
      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur rounded-2xl shadow-lg p-8 text-center border border-slate-800">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-white tracking-tight">
          {t("pages.welcome.title")}
        </h1>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate("/login")}
            className="w-full rounded-xl bg-blue-500 px-5 py-3 text-lg font-semibold text-white shadow-sm
                     hover:bg-blue-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200
                     transition-all duration-200 ease-in-out"
          >
            {t("pages.welcome.haveAccount")}
          </button>

          <button
            onClick={() => navigate("/invitation/accept")}
            className="w-full rounded-xl border border-blue-400 bg-white/95 px-5 py-3 text-lg font-semibold text-blue-700
                     hover:bg-blue-50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200
                     transition-all duration-200 ease-in-out"
          >
            {t("pages.welcome.haveInvitation")}
          </button>
        </div>
      </div>
    </PublicLayout>
  );
}
