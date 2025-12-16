import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/ui/LanguageSwitcher";

export default function Welcome() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 relative overflow-hidden">
      {/* 🔹 Language Switcher arriba a la derecha */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      {/* 🔹 Contenedor central */}
      <div className="w-full max-w-md bg-slate-700/95 backdrop-blur rounded-2xl shadow-lg p-8 text-center border border-slate-600">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-white tracking-tight">
          {t("pages.welcome.title")}
        </h1>

        {/* Botones */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate("/login")}
            className="w-full rounded-xl bg-blue-500 px-5 py-3 text-lg font-semibold text-white shadow-sm
                     hover:bg-blue-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200
                     transition-all duration-200 ease-in-out"
          >
            {t("pages.welcome.login")}
          </button>

          <button
            onClick={() => navigate("/register")}
            className="w-full rounded-xl border border-blue-400 bg-white/95 px-5 py-3 text-lg font-semibold text-blue-700
                     hover:bg-blue-50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200
                     transition-all duration-200 ease-in-out"
          >
            {t("pages.welcome.register")}
          </button>
        </div>
      </div>

      {/* 🔹 Footer fijo */}
      <footer className="absolute bottom-4 text-xs text-slate-500">
        &copy; 2025 Ambulancias Gorruiz
      </footer>
    </div>
  );
}
