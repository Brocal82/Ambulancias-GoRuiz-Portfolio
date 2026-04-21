// src/modules/praemien/pages/WorkerPraemienPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getMonthlyPraemienSummary } from "../domain/api";
import type { MonthlyPraemienDay } from "../domain/api";
import WorkerPraemienHistory from "../components/WorkerPraemienHistory";
import MonthlyMiniCalendar from "../components/MonthlyMiniCalendar";
import PraemieProgressBars from "../components/PraemieProgressBars";
import WorkerManualPraemienMonthPanel from "../components/WorkerManualPraemienMonthPanel";
import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import {
  formatPraemienEffectiveMonthLabel,
  isPraemienManualEntryPhaseActive,
} from "../utils/isPraemienManualEntryPhaseActive";

const WorkerPraemienPage = () => {
  const { token, praemienMode, praemienModeEffectiveFrom } = useAuth();
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
    if (!token || manualPhaseActive) {
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
  }, [token, t, manualPhaseActive]);

  if (!manualPhaseActive && loading)
    return (
      <p className="p-4 text-center">{t("pages.praemien.page.loading")}</p>
    );
  if (!manualPhaseActive && error)
    return <p className="p-4 text-center text-red-600">{error}</p>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-center mb-8">
          {t("pages.praemien.page.title")}
        </h1>

        {manualPendingNotice && (
          <div className="mx-auto mb-6 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
            {t("pages.praemien.manual.pendingNotice", {
              monthYear: formatPraemienEffectiveMonthLabel(
                praemienModeEffectiveFrom,
                i18n.language,
              ),
            })}
          </div>
        )}

        {!manualPhaseActive && (
          <>
            <PraemieProgressBars averagePatients={media} days={summaries} />
            <div className="mx-auto max-w-3xl">
              <MonthlyMiniCalendar days={summaries} />
            </div>
          </>
        )}

        {manualPhaseActive && praemienModeEffectiveFrom && (
          <div className="mx-auto max-w-3xl mb-8">
            <WorkerManualPraemienMonthPanel
              effectiveFrom={praemienModeEffectiveFrom}
            />
          </div>
        )}

        <div className="mx-auto max-w-3xl mt-8">
          <WorkerPraemienHistory />
        </div>
      </div>
    </div>
  );
};

export default WorkerPraemienPage;
