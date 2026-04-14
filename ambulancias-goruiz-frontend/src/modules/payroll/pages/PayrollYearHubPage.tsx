import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { listPayrollDocuments } from "../domain/api";
import type { PayrollDocument } from "../domain/types";
import PayrollGlobalSearchPanel from "../components/PayrollGlobalSearchPanel";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

  const goToMonthWorkspace = (year: number, month: number) => {
    navigate(`/admin/payroll/month/${year}/${month}`);
  };

  const shiftYear = (delta: -1 | 1) => {
    setHubYear((y) => y + delta);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
            {MONTH_NAMES.map((name, idx) => {
              const month = idx + 1;
              const status = monthCellStatus(docs, hubYear, month);
              const ring =
                status === "empty"
                  ? "ring-slate-200 bg-slate-50/80"
                  : status === "incomplete"
                    ? "ring-amber-300 bg-amber-50/50"
                    : "ring-emerald-200 bg-emerald-50/40";
              const subtitle =
                status === "empty"
                  ? "Sin datos"
                  : status === "incomplete"
                    ? "Pendientes"
                    : "Sin pendientes de asignación";
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => goToMonthWorkspace(hubYear, month)}
                  className={`rounded-xl p-4 text-left ring-1 shadow-sm transition-colors hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-200 ${ring}`}
                >
                  <span className="block text-sm font-semibold text-slate-800">
                    {name}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {subtitle}
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
