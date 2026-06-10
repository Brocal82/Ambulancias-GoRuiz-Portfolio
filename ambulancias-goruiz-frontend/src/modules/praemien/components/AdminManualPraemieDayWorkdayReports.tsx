import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import AdminWorkdaySummaryGroupContent from "../../workday/components/AdminWorkdaySummaryGroupContent";
import type { WorkdaySummary } from "../../workday/domain/types/workdaySummary";
import { getAdminManualPraemieDayWorkdaySummaries } from "../domain/manualDailyApi";

type Props = {
  userId: string;
  date: string;
};

export function AdminManualPraemieDayWorkdayReports({ userId, date }: Props) {
  const { t } = useTranslation();
  const [summaries, setSummaries] = useState<WorkdaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchSeq = useRef(0);

  useEffect(() => {
    const id = ++fetchSeq.current;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const data = await getAdminManualPraemieDayWorkdaySummaries(userId, date);
        if (id !== fetchSeq.current) return;
        setSummaries(data);
      } catch {
        if (id !== fetchSeq.current) return;
        setSummaries([]);
        setError(t("pages.praemien.adminManual.workdayReportsLoadError"));
      } finally {
        if (id === fetchSeq.current) {
          setLoading(false);
        }
      }
    })();
  }, [userId, date, t]);

  if (loading) {
    return (
      <p className="text-xs text-slate-500">
        {t("pages.praemien.adminManual.workdayReportsLoading")}
      </p>
    );
  }

  if (error) {
    return <p className="text-xs text-rose-700">{error}</p>;
  }

  if (summaries.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        {t("pages.praemien.adminManual.workdayReportsEmpty")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {t("pages.praemien.adminManual.workdayReportsTitle")}
      </p>
      <AdminWorkdaySummaryGroupContent summaries={summaries} compact />
    </div>
  );
}
