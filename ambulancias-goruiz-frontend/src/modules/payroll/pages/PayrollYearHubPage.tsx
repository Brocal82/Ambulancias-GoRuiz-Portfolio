import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import {
  getPayrollCoverageYearSummary,
  listPayrollDocuments,
} from "../domain/api";
import type {
  CoverageYearSummaryResponse,
  PayrollDocument,
} from "../domain/types";
import PayrollGlobalSearchPanel from "../components/PayrollGlobalSearchPanel";
import { PAYROLL_MONTH_NAMES } from "../domain/constants";
import BackButton from "../../../components/ui/BackButton";

type MonthCellStatus = "empty" | "incomplete" | "complete";

function monthCellStatus(
  docs: PayrollDocument[],
  year: number,
  month: number,
): MonthCellStatus {
  const monthDocs = docs.filter(
    (d) => d.year === year && d.month === month,
  );
  if (monthDocs.length === 0) return "empty";
  if (monthDocs.some((d) => d.matchStatus === "unmatched"))
    return "incomplete";
  return "complete";
}

export default function PayrollYearHubPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [hubYear, setHubYear] = useState(() => new Date().getFullYear());
  const [docs, setDocs] = useState<PayrollDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [yearCoverage, setYearCoverage] =
    useState<CoverageYearSummaryResponse | null>(null);
  const toolbarResultsPortalRef = useRef<HTMLDivElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPayrollDocuments();
      setDocs(data);
    } catch (err) {
      toastT.apiError(err, "Error al cargar los documentos de nómina");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchDocs();
  }, [token, fetchDocs]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void getPayrollCoverageYearSummary(hubYear)
      .then((data) => {
        if (cancelled) return;
        setYearCoverage(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setYearCoverage(null);
        toastT.apiError(err, "Error al cargar los contadores de cobertura anual");
      });
    return () => {
      cancelled = true;
    };
  }, [token, hubYear]);

  const goToMonthWorkspace = (year: number, month: number) => {
    navigate(`/admin/payroll/month/${year}/${month}`);
  };

  const shiftYear = (delta: -1 | 1) => {
    setHubYear((y) => y + delta);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <BackButton to="/admin/payroll" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Nóminas
          </h1>
          <p className="text-sm text-slate-600">
            Resumen anual y búsqueda. Abre un mes para subir nóminas y resolver incidencias.
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <button
                  type="button"
                  onClick={() => shiftYear(-1)}
                  aria-label="Año anterior"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  ←
                </button>
                <h2 className="text-base font-semibold text-slate-800 min-w-[7.5rem] text-center">
                  Año {hubYear}
                </h2>
                <button
                  type="button"
                  onClick={() => shiftYear(1)}
                  aria-label="Año siguiente"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  →
                </button>
              </div>

              <div className="w-full lg:w-auto lg:ml-auto">
                <PayrollGlobalSearchPanel
                  docs={docs}
                  loading={loading}
                  onRefresh={fetchDocs}
                  contextYear={hubYear}
                  hubCompactLookup
                  compactToolbar
                  resultsPortalTarget={toolbarResultsPortalRef.current}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {PAYROLL_MONTH_NAMES.map((name, idx) => {
              const month = idx + 1;
              const status = monthCellStatus(docs, hubYear, month);
              const assignedCount =
                yearCoverage?.months.find((item) => item.month === month)
                  ?.assignedCount ?? 0;
              const totalWorkers = yearCoverage?.totalWorkers ?? 0;
              const missingWorkers = Math.max(totalWorkers - assignedCount, 0);
              const ring =
                status === "empty"
                  ? "ring-slate-200 bg-slate-50/80"
                  : status === "incomplete"
                    ? "ring-amber-300 bg-amber-50/50"
                    : "ring-emerald-200 bg-emerald-50/40";
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => goToMonthWorkspace(hubYear, month)}
                  className={`rounded-xl p-4 text-left ring-1 shadow-sm transition-colors hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-200 h-24 ${ring}`}
                >
                  <span className="flex h-full flex-col">
                    <span className="block text-sm font-semibold text-slate-800">
                      {name}
                    </span>
                    <span className="mt-auto flex justify-between items-end w-full text-xs">
                      <span className="text-slate-600">
                        👤 {totalWorkers}{" "}
                        {totalWorkers > 0 && missingWorkers === 0 ? (
                          "✅"
                        ) : assignedCount > 0 && missingWorkers > 0 ? (
                          <span className="text-red-600 font-medium">
                            ({missingWorkers})
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="text-slate-600"
                      >
                        📄 {assignedCount}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div ref={toolbarResultsPortalRef} className="mt-4" />
        </div>
      </div>
    </div>
  );
}
