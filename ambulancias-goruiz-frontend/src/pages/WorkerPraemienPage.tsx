// src/pages/WorkerPraemienPage.tsx
import { useEffect, useMemo, useState } from "react";
import { getMonthlyPraemienSummary } from "../api/praemien";
import type { MonthlyPraemienDay } from "../api/praemien";
import { saveMonthlyPraemie } from "../api/praemienHistory";
import WorkerPraemienHistory from "../components/praemien/WorkerPraemienHistory";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import MonthlyMiniCalendar from "../components/praemien/MonthlyMiniCalendar";
import {
  getPraemieI18nKey,
  getPraemieLevelFromAverage,
} from "../utils/praemien/praemienLevels";
import PraemieProgressBars from "../components/praemien/PraemieProgressBars";


const WorkerPraemienPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [summaries, setSummaries] = useState<MonthlyPraemienDay[]>([]);
  const [media, setMedia] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    getMonthlyPraemienSummary(token)
      .then((data) => {
        setSummaries(data.monthlyData);
        setMedia(data.averagePatients);
      })
      .catch(() => {
        setError(t("pages.praemien.page.error"));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, t]);

  // Nivel global (derivado, no estado)
  const premieLevelLabel = useMemo(() => {
    const level = getPraemieLevelFromAverage(media);
    return t(getPraemieI18nKey(level));
  }, [media, t]);

  // Guarda el resumen mensual (mantenemos la lógica; guardamos la etiqueta localizada actual)
  useEffect(() => {
    if (!token) return;
    if (media === 0) return;

    const now = new Date();
    const monthString = now.toISOString().slice(0, 7); // 'YYYY-MM'

    saveMonthlyPraemie(token, {
      month: monthString,
      averagePatients: media,
      premieLevel: premieLevelLabel,
    })
      .then(() => {
        // ok
      })
      .catch(() => {
        // silent warning, como antes
        console.warn("No se pudo guardar el resumen mensual.");
      });
  }, [media, premieLevelLabel, token]);


  if (loading)
    return (
      <p className="p-4 text-center">{t("pages.praemien.page.loading")}</p>
    );
  if (error) return <p className="p-4 text-center text-red-600">{error}</p>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-center mb-4">
          {t("pages.praemien.page.title")}
        </h1>

        {/* Nivel global alcanzado */}
        {media > 0 && (
          <p className="text-center text-sm text-slate-700 mb-6">
            {t("pages.praemien.page.globalLevel")}{" "}
            <span className="font-semibold text-blue-600">
              {premieLevelLabel}
            </span>
          </p>
        )}

        {/* Barras de prämien */}
        <PraemieProgressBars averagePatients={media} days={summaries} />


        {/* Historial diario (mini-calendario mensual) */}
        <div className="mx-auto max-w-3xl">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {t("pages.praemien.page.dailyHistoryTitle")}
          </h2>

          <MonthlyMiniCalendar days={summaries} />
        </div>


        {/* Historial mensual (componente existente) */}
        <div className="mx-auto max-w-3xl mt-8">
          <WorkerPraemienHistory />
        </div>
      </div>
    </div>
  );
};

export default WorkerPraemienPage;
