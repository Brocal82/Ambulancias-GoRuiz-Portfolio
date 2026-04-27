import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";

/**
 * Inicio del jefe de mecánicos: enlaces claros a flota (ambulancias) y a reportes/taller.
 * No sustituye las pantallas existentes; solo centraliza la “portada” tras el login.
 */
export default function JefeMecanicosDashboardPage() {
  const { t } = useTranslation();
  const { hasModule } = useModules();
  const ambulancesOn = hasModule(MODULE_KEYS.AMBULANCES);
  const mechanicsOn = hasModule(MODULE_KEYS.MECHANICS);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-center mb-1">
            {t("pages.mechanics.chiefDashboard.title")}
          </h1>
          <p className="text-sm text-slate-600 text-center mb-8">
            {t("pages.mechanics.chiefDashboard.subtitle")}
          </p>

          <ul className="grid gap-4 sm:grid-cols-2">
            {ambulancesOn ? (
              <li>
                <Link
                  to="/mechanics/ambulances"
                  className="block rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm hover:border-blue-300 hover:bg-blue-50/50 transition ring-1 ring-transparent hover:ring-blue-100"
                >
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">
                    {t("pages.mechanics.chiefDashboard.cardAmbulancesTitle")}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {t("pages.mechanics.chiefDashboard.cardAmbulancesDesc")}
                  </p>
                  <span className="mt-3 inline-block text-sm font-medium text-blue-600">
                    {t("pages.mechanics.chiefDashboard.cardCta")} →
                  </span>
                </Link>
              </li>
            ) : null}

            {mechanicsOn ? (
              <li>
                <Link
                  to="/mechanics"
                  className="block rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm hover:border-blue-300 hover:bg-blue-50/50 transition ring-1 ring-transparent hover:ring-blue-100"
                >
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">
                    {t("pages.mechanics.chiefDashboard.cardReportsTitle")}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {t("pages.mechanics.chiefDashboard.cardReportsDesc")}
                  </p>
                  <span className="mt-3 inline-block text-sm font-medium text-blue-600">
                    {t("pages.mechanics.chiefDashboard.cardCta")} →
                  </span>
                </Link>
              </li>
            ) : null}
          </ul>

          {!ambulancesOn && !mechanicsOn ? (
            <p className="text-center text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              {t("pages.mechanics.chiefDashboard.noModules")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
