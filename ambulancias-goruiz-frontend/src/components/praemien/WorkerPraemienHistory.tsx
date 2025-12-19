import { useEffect, useMemo, useState } from "react";
import type { MonthlyPraemieHistoryItem } from "../../api/praemien";
import { getPraemienMonthlyHistory } from "../../api/praemien";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import {
  getPraemieI18nKey,
  getPraemieLevelFromAverage,
} from "../../utils/praemien/praemienLevels";

interface Props {
  userId?: string;
}

const MONTHS = [
  { month: 1, label: "Jan" },
  { month: 2, label: "Feb" },
  { month: 3, label: "Mar" },
  { month: 4, label: "Apr" },
  { month: 5, label: "May" },
  { month: 6, label: "Jun" },
  { month: 7, label: "Jul" },
  { month: 8, label: "Aug" },
  { month: 9, label: "Sep" },
  { month: 10, label: "Oct" },
  { month: 11, label: "Nov" },
  { month: 12, label: "Dec" },
];

const WorkerPraemienHistory = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [history, setHistory] = useState<MonthlyPraemieHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getPraemienMonthlyHistory(token, userId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, userId]);

  // Elegimos el año “más reciente” con datos
  const selectedYear = useMemo(() => {
    if (!history.length) {
      return new Date().getFullYear(); // año actual si no hay historial
    }
    return history.reduce(
      (max, item) => Math.max(max, item.year),
      history[0].year,
    );
  }, [history]);


  // Mapa de lookup: "year-month" -> item
  const historyMap = useMemo(() => {
    const map = new Map<string, MonthlyPraemieHistoryItem>();
    history.forEach((item) => {
      map.set(`${item.year}-${item.month}`, item);
    });
    return map;
  }, [history]);

  if (loading) {
    return (
      <p className="p-3 text-center text-sm text-slate-600">
        {t("pages.praemien.history.loading")}
      </p>
    );
  }


  return (
    <div className="max-w-4xl mx-auto mt-6 rounded-2xl bg-white ring-1 ring-slate-200 p-4 shadow-sm">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-900">
          {t("pages.praemien.history.title")}
        </h2>
        <span className="text-xs text-slate-500 tabular-nums">{selectedYear}</span>
      </div>

      {/* 2 filas x 6 columnas: compacto */}
      <div className="grid grid-cols-6 gap-2">
        {MONTHS.map(({ month, label }) => {
          const item = historyMap.get(`${selectedYear}-${month}`);

          // Si hay datos, calculamos nivel; si no, "none"
          const level = item
            ? getPraemieLevelFromAverage(item.averagePatients)
            : 0;

          // nivel 0 -> none
          const levelKey = getPraemieI18nKey(level);
          const levelText = t(levelKey);

          // Estilo sutil: solo un toque de color si hay prämie
          const hasPremie = level >= 7;

          const boxClass = hasPremie
            ? "bg-blue-50 ring-blue-100"
            : "bg-white ring-slate-200";

          return (
            <div
              key={`${selectedYear}-${month}`}
              className={[
                "rounded-md ring-1 px-1.5 py-2",
                "flex flex-col items-center justify-center text-center gap-0.5",
                boxClass,
              ].join(" ")}
            >
              {/* Mes */}
              <div className="text-[10px] font-bold text-slate-700 leading-none">
                {label}
              </div>

              {/* Prämie */}
              <div className="text-[10px] leading-tight text-slate-900">
                {levelText}
              </div>
            </div>

          );
        })}
      </div>
    </div>
  );
};

export default WorkerPraemienHistory;
