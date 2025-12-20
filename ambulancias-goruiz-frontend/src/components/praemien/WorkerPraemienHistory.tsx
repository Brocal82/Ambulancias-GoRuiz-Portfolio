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

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1..12

  // Elegimos el año “más reciente” con datos
  const selectedYear = useMemo(() => {
    if (!history.length) {
      return currentYear; // año actual si no hay historial
    }
    return history.reduce(
      (max, item) => Math.max(max, item.year),
      history[0].year,
    );
  }, [history, currentYear]);

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
        <span className="text-xs text-slate-500 tabular-nums">
          {selectedYear}
        </span>
      </div>

      {/* 2 filas x 6 columnas: compacto */}
      <div className="grid grid-cols-6 gap-2">
        {MONTHS.map(({ month, label }) => {
          const item = historyMap.get(`${selectedYear}-${month}`);

          const isCurrentMonthBox =
            selectedYear === currentYear && month === currentMonth;

          // Si hay datos, calculamos nivel; si no, "none"
          const level = item
            ? getPraemieLevelFromAverage(item.averagePatients)
            : 0;

          const levelKey = getPraemieI18nKey(level);
          const levelText = t(levelKey);

          // Estilo sutil: solo un toque de color si hay prämie
          const hasPremie = level >= 7;

          // 🎨 Estilo: mes actual con look neutro y “pendiente”
          const boxClass = isCurrentMonthBox
            ? "bg-slate-50 ring-slate-200"
            : hasPremie
              ? "bg-blue-50 ring-blue-100"
              : "bg-white ring-slate-200";

          return (
            <div
              key={`${selectedYear}-${month}`}
              className={[
                "rounded-md ring-1 overflow-hidden", // 👈 overflow para que el header respete bordes
                "flex flex-col text-center",
                boxClass,
              ].join(" ")}
            >
              {/* Header del mes (franja completa) */}
              <div
                className="w-full bg-slate-100/80 border-b border-slate-200 py-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 leading-none">
                  {label}
                </div>
              </div>

              {/* Contenido */}
              <div className="px-1.5 py-2 flex items-center justify-center">
                <div className="text-[10px] leading-tight text-slate-900">
                  {isCurrentMonthBox ? "⏳" : levelText}
                </div>
              </div>
            </div>

          );
        })}
      </div>
    </div>
  );
};

export default WorkerPraemienHistory;
