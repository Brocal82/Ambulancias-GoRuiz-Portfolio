import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSecurityMonitoringSummary } from "../domain/api";
import type { SecurityMonitoringSnapshot } from "../domain/types";

const WINDOW_OPTIONS = [24, 48, 72, 168];

export default function SuperadminSecurityMonitoringPage() {
  const { t } = useTranslation();
  const [hours, setHours] = useState<number>(24);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SecurityMonitoringSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSecurityMonitoringSummary(hours);
        if (!cancelled) {
          setSnapshot(data);
        }
      } catch (err) {
        if (!cancelled) {
          setSnapshot(null);
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [hours]);

  const cards = useMemo(() => {
    if (!snapshot) return [];
    const s = snapshot.supportAccess;
    return [
      { key: "requested", value: s.requested },
      { key: "denied", value: s.denied },
      { key: "approvalRecorded", value: s.approvalRecorded },
      { key: "approvedFinal", value: s.approvedFinal },
      { key: "revoked", value: s.revoked },
      { key: "expired", value: s.expired },
      { key: "offHoursFinalApprovals", value: s.offHoursFinalApprovals },
    ];
  }, [snapshot]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t("pages.superadminSecurityMonitoring.title")}
          </h1>
          <p className="text-slate-600 mt-1">
            {t("pages.superadminSecurityMonitoring.subtitle")}
          </p>
        </div>
        <Link
          to="/superadmin"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {t("pages.superadminSecurityMonitoring.backToPanel")}
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <label htmlFor="monitoring-hours" className="text-sm font-medium text-slate-700">
          {t("pages.superadminSecurityMonitoring.windowLabel")}
        </label>
        <select
          id="monitoring-hours"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t("pages.superadminSecurityMonitoring.hoursOption", { hours: option })}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
          {t("pages.superadminSecurityMonitoring.loading")}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {t("pages.superadminSecurityMonitoring.loadError")}: {error}
        </div>
      )}

      {!loading && !error && snapshot && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((card) => (
              <div key={card.key} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {t(`pages.superadminSecurityMonitoring.cards.${card.key}`)}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("pages.superadminSecurityMonitoring.metaTitle")}
            </h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p>
                <span className="font-medium">{t("pages.superadminSecurityMonitoring.generatedAt")}: </span>
                {new Date(snapshot.generatedAt).toLocaleString()}
              </p>
              <p>
                <span className="font-medium">{t("pages.superadminSecurityMonitoring.windowHours")}: </span>
                {snapshot.windowHours}
              </p>
              <p>
                <span className="font-medium">{t("pages.superadminSecurityMonitoring.deniedThreshold")}: </span>
                {snapshot.deniedThreshold}
              </p>
              <p>
                <span className="font-medium">{t("pages.superadminSecurityMonitoring.range")}: </span>
                {new Date(snapshot.supportAccess.since).toLocaleString()} -{" "}
                {new Date(snapshot.supportAccess.until).toLocaleString()}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
