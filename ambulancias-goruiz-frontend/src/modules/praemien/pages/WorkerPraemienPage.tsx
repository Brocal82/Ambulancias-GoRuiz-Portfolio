// src/modules/praemien/pages/WorkerPraemienPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getMonthlyPraemienSummary } from "../domain/api";
import type { MonthlyPraemienDay } from "../domain/api";
import WorkerPraemienHistory from "../components/WorkerPraemienHistory";
import MonthlyMiniCalendar from "../components/MonthlyMiniCalendar";
import PraemieProgressBars from "../components/PraemieProgressBars";
import WorkerManualPraemienMonthPanel from "../components/WorkerManualPraemienMonthPanel";
import { usePraemienDienstDayTints } from "../hooks/usePraemienDienstDayTints";
import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import {
  formatPraemienEffectiveMonthLabel,
  isPraemienManualEntryPhaseActive,
} from "../utils/isPraemienManualEntryPhaseActive";

const PRAEMIEN_WORKER_HELP_URL: string | undefined = import.meta.env
  .VITE_PRAEMIEN_WORKER_HELP_URL as string | undefined;

/** Solo monta en modo resumen automático: evita duplicar fetch con el panel manual. */
function WorkerAutomaticPraemieCalendarView({
  days,
}: {
  days: MonthlyPraemienDay[];
}) {
  const { userId } = useAuth();
  const { dayBaseClassName } = usePraemienDienstDayTints(userId);
  return (
    <div className="mx-auto max-w-4xl">
      <MonthlyMiniCalendar
        days={days}
        dayBaseClassName={dayBaseClassName}
      />
    </div>
  );
}

const WorkerPraemienPage = () => {
  const { token, praemienMode, praemienModeEffectiveFrom, companyPraemienConfigReady } =
    useAuth();
  const { hasModule } = useModules();
  const { t, i18n } = useTranslation();

  const [summaries, setSummaries] = useState<MonthlyPraemienDay[]>([]);
  const [media, setMedia] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const praemienEnabled = hasModule(MODULE_KEYS.PRAEMIEN);
  const manualPhaseActive = useMemo(
    () =>
      isPraemienManualEntryPhaseActive({
        praemienEnabled,
        praemienMode,
        praemienModeEffectiveFrom,
      }),
    [praemienEnabled, praemienMode, praemienModeEffectiveFrom],
  );

  const manualPendingNotice =
    praemienEnabled &&
    praemienMode === "manual" &&
    praemienModeEffectiveFrom != null &&
    !manualPhaseActive;

  useEffect(() => {
    if (!token || !companyPraemienConfigReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    getMonthlyPraemienSummary()
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
  }, [token, companyPraemienConfigReady, t]);

  if (token && !companyPraemienConfigReady) {
    return (
      <p className="p-4 text-center">{t("pages.praemien.page.loading")}</p>
    );
  }

  if (!manualPhaseActive && loading)
    return (
      <p className="p-4 text-center">{t("pages.praemien.page.loading")}</p>
    );
  if (!manualPhaseActive && error) {
    return <p className="p-4 text-center text-red-600">{error}</p>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <h1
          className={`text-2xl font-semibold tracking-tight text-slate-900 text-center ${
            PRAEMIEN_WORKER_HELP_URL ? "mb-3" : "mb-8"
          }`}
        >
          {t("pages.praemien.page.title")}
        </h1>
        {PRAEMIEN_WORKER_HELP_URL && (
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-slate-600">
            <a
              href={PRAEMIEN_WORKER_HELP_URL}
              className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("pages.praemien.page.helpLinkLabel")}
            </a>
          </p>
        )}

        {manualPendingNotice && (
          <div className="mx-auto mb-6 max-w-4xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
            {t("pages.praemien.manual.pendingNotice", {
              monthYear: formatPraemienEffectiveMonthLabel(
                praemienModeEffectiveFrom,
                i18n.language,
              ),
            })}
          </div>
        )}

        {manualPhaseActive && error && (
          <p className="mx-auto mb-4 max-w-4xl text-center text-sm text-amber-900">
            {t("pages.praemien.page.summaryErrorHint")}
          </p>
        )}

        {!error && !loading && (
          <PraemieProgressBars averagePatients={media} days={summaries} />
        )}

        {manualPhaseActive && !error && loading && (
          <p className="mx-auto mb-6 max-w-4xl text-center text-sm text-slate-500">
            {t("pages.praemien.page.summaryLoading")}
          </p>
        )}

        {!manualPhaseActive && !error && !loading && (
          <WorkerAutomaticPraemieCalendarView days={summaries} />
        )}

        {manualPhaseActive && praemienModeEffectiveFrom && (
          <div
            className="mb-8 mt-6 w-full min-w-0 scroll-mt-4"
            id="worker-praemien-manual-entry"
          >
            <WorkerManualPraemienMonthPanel
              effectiveFrom={praemienModeEffectiveFrom}
            />
          </div>
        )}

        <div className="mx-auto max-w-4xl mt-8">
          <WorkerPraemienHistory />
        </div>
      </div>
    </div>
  );
};

export default WorkerPraemienPage;
