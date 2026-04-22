import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { openSecureFile } from "../../../utils/openSecureFile";
import { toastT } from "../../../utils/toast";
import type { PayrollDocument } from "../domain/types";
import MatchBadge from "./MatchBadge";
import { PAYROLL_MONTH_NAMES } from "../domain/constants";
import { matchesPayrollDocumentText } from "../domain/predicates";
import {
  APP_NAV_MATCH_TABLE_HEADER_TR,
  APP_NAV_MATCH_TABLE_THEAD_STICKY,
} from "../../../components/ui/appTableHeader";

const HUB_LOOKUP_MAX_RESULTS = 12;

function workerDisplayName(w: PayrollDocument["workerId"]): string {
  if (!w) return "—";
  return `${w.lastName}, ${w.name}`;
}

function periodLabel(year?: number, month?: number): string {
  if (!year && !month) return "—";
  const m = month ? PAYROLL_MONTH_NAMES[month - 1] : "";
  return [m, year].filter(Boolean).join(" ");
}

export interface PayrollGlobalSearchPanelProps {
  docs: PayrollDocument[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  /** Optional; hub lookup no longer needs month navigation from results. */
  onGoToMonth?: (year: number, month: number) => void;
  /** Included in year dropdown options alongside doc years and current calendar year. */
  contextYear: number;
  /** Explains where month operations happen (hub vs workspace). */
  helperText?: string;
  /** When false, only filters + header are shown (workspace only; ignored if hubCompactLookup). */
  showResultsTable?: boolean;
  /** Year Hub: compact live results (max 12) only while año, mes o texto están activos. */
  hubCompactLookup?: boolean;
  /** Year Hub toolbar mode: compact search control integrated in parent row. */
  compactToolbar?: boolean;
  /** Optional portal target for rendering results outside the toolbar row. */
  resultsPortalTarget?: HTMLElement | null;
}

/**
 * Read-focused global payroll lookup (filters + Ver on results).
 */
export default function PayrollGlobalSearchPanel({
  docs,
  loading,
  onRefresh,
  onGoToMonth,
  contextYear,
  helperText: _helperText = "Búsqueda rápida. La gestión del mes (asignar, eliminar) se hace arriba en el espacio del mes seleccionado.",
  showResultsTable = true,
  hubCompactLookup = false,
  compactToolbar = false,
  resultsPortalTarget,
}: PayrollGlobalSearchPanelProps) {
  const ALL_FILTER_VALUE = "__all__";
  const NONE_FILTER_VALUE = "__none__";
  const [tableSearch, setTableSearch] = useState("");
  const [tableYearFilter, setTableYearFilter] = useState("");
  const [tableMonthFilter, setTableMonthFilter] = useState("");

  const tableYearOptions = useMemo(
    () =>
      Array.from(
        new Set([
          new Date().getFullYear(),
          contextYear,
          ...docs.map((d) => d.year).filter((y): y is number => y !== undefined),
        ]),
      ).sort((a, b) => b - a),
    [docs, contextYear],
  );

  const isTableFiltered =
    tableSearch.trim() !== "" ||
    tableYearFilter !== "" ||
    tableMonthFilter !== "";

  const filteredDocs = useMemo(() => {
    const base = isTableFiltered
      ? docs.filter((doc) => {
          if (
            tableYearFilter &&
            tableYearFilter !== ALL_FILTER_VALUE &&
            doc.year !== Number(tableYearFilter)
          )
            return false;
          if (
            tableMonthFilter &&
            tableMonthFilter !== ALL_FILTER_VALUE &&
            doc.month !== Number(tableMonthFilter)
          )
            return false;
          if (tableSearch.trim()) {
            const q = tableSearch.trim().toLowerCase();
            if (!matchesPayrollDocumentText(doc, q)) return false;
          }
          return true;
        })
      : docs.slice();
    return base.sort((a, b) => {
      if (a.matchStatus === "unmatched" && b.matchStatus !== "unmatched")
        return -1;
      if (a.matchStatus !== "unmatched" && b.matchStatus === "unmatched")
        return 1;
      return 0;
    });
  }, [docs, isTableFiltered, tableMonthFilter, tableSearch, tableYearFilter]);

  const hubLookupActive = hubCompactLookup && isTableFiltered;
  const hubFilteredSorted = hubLookupActive ? filteredDocs : [];
  const hubVisibleDocs = hubFilteredSorted.slice(0, HUB_LOOKUP_MAX_RESULTS);
  const hubHasMoreThanCap = hubFilteredSorted.length > HUB_LOOKUP_MAX_RESULTS;

  const thClass =
    "px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-200";
  const trClass =
    "border-t border-slate-200 hover:bg-slate-50/70 transition-colors";

  const handleOpenFile = async (filename: string, originalName: string) => {
    try {
      await openSecureFile(filename, originalName);
    } catch (err) {
      toastT.apiError(err, "Error al abrir el archivo");
    }
  };

  const resultsContent =
    hubCompactLookup && hubLookupActive ? (
      loading && docs.length === 0 ? (
        <div className="p-3 text-center text-sm text-slate-500">
          Cargando documentos...
        </div>
      ) : docs.length === 0 ? (
        <div className="p-3 text-center text-sm text-slate-500">
          No hay documentos de nómina todavía.
        </div>
      ) : hubFilteredSorted.length === 0 ? (
        <div className="p-3 text-center text-sm text-slate-500">
          Ningún documento coincide con la búsqueda.
        </div>
      ) : (
        <div className="border-t border-slate-100">
          {hubHasMoreThanCap ? (
            <p className="px-4 py-1 text-[11px] leading-snug text-slate-500 bg-slate-50/80">
              Mostrando {HUB_LOOKUP_MAX_RESULTS} de {hubFilteredSorted.length}.
              Refina la búsqueda para acotar.
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className={APP_NAV_MATCH_TABLE_HEADER_TR}>
                  <th className="px-3 py-1 font-medium text-slate-200">
                    Nombre del empleado
                  </th>
                  <th className="px-2 py-1 font-medium text-slate-200 whitespace-nowrap">
                    Nº empleado
                  </th>
                  <th className="px-2 py-1 font-medium text-slate-200 whitespace-nowrap">
                    Mes / período
                  </th>
                  <th className="px-2 py-1 font-medium text-slate-200 text-center">
                    Estado
                  </th>
                  <th className="w-[64px] px-2 py-1 font-medium text-slate-200 text-center">
                    Ver
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hubVisibleDocs.map((doc) => {
                  const name = workerDisplayName(doc.workerId);
                  const empNum =
                    doc.workerId?.employeeNumber ?? doc.parsedEmployeeNumber;
                  const period = periodLabel(doc.year, doc.month);
                  return (
                    <tr
                      key={doc._id}
                      className={
                        doc.matchStatus === "unmatched"
                          ? "bg-amber-50/35"
                          : "bg-white"
                      }
                    >
                      <td
                        className="px-3 py-1.5 text-slate-800 max-w-[200px] truncate align-middle"
                        title={
                          name === "—" ? doc.originalName : undefined
                        }
                      >
                        {name}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap tabular-nums align-middle">
                        {empNum ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap align-middle">
                        {period !== "—" ? period : "—"}
                      </td>
                      <td className="px-2 py-1 text-center align-middle">
                        <MatchBadge status={doc.matchStatus} />
                      </td>
                      <td className="px-2 py-1 text-center align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenFile(doc.filename, doc.originalName)
                          }
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )
    ) : showResultsTable && !hubCompactLookup ? (
      loading && docs.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          Cargando documentos...
        </div>
      ) : docs.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          No hay documentos de nómina todavía.
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          Ningún documento coincide con la búsqueda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-center">
            <thead className={APP_NAV_MATCH_TABLE_THEAD_STICKY}>
              <tr>
                <th className={`${thClass} text-left`}>Archivo</th>
                <th className={thClass}>Trabajador</th>
                <th className={thClass}>Estado</th>
                <th className={thClass}>Período</th>
                <th className={thClass}>Acciones</th>
              </tr>
            </thead>

            <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
              {filteredDocs.map((doc) => (
                <tr
                  key={doc._id}
                  className={
                    doc.matchStatus === "unmatched"
                      ? "border-t border-slate-200 !bg-amber-50/40 hover:bg-amber-100/50 transition-colors"
                      : trClass
                  }
                >
                  <td className="px-3 py-2 text-left align-top">
                    <span
                      className="block text-slate-800 font-medium truncate max-w-[220px]"
                      title={doc.originalName}
                    >
                      {doc.originalName}
                    </span>
                    {doc.parsedEmployeeNumber && (
                      <span className="text-xs text-slate-500">
                        Nº empleado detectado: {doc.parsedEmployeeNumber}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 align-top">
                    <span className="text-slate-800">
                      {workerDisplayName(doc.workerId)}
                    </span>
                    {doc.workerId?.employeeNumber && (
                      <span className="block text-xs text-slate-500">
                        {doc.workerId.employeeNumber}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 align-top">
                    <MatchBadge status={doc.matchStatus} />
                    {doc.matchStatus === "unmatched" && doc.matchReason && (
                      <p
                        className="mt-1 text-xs text-slate-500 max-w-[180px] mx-auto"
                        title={doc.matchReason}
                      >
                        {doc.matchReason.length > 60
                          ? `${doc.matchReason.slice(0, 60)}…`
                          : doc.matchReason}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {periodLabel(doc.year, doc.month) !== "—" ? (
                      periodLabel(doc.year, doc.month)
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenFile(doc.filename, doc.originalName)
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                      >
                        📄 Ver
                      </button>
                      {onGoToMonth &&
                      doc.year !== undefined &&
                      doc.month !== undefined ? (
                        <button
                          type="button"
                          onClick={() =>
                            onGoToMonth(doc.year!, doc.month!)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-100"
                        >
                          Ir al mes
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    ) : null;

  return (
    <div className={compactToolbar ? "space-y-2" : "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden"}>
      {compactToolbar ? (
        <div className="w-full">
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:justify-end">
            <span aria-hidden className="text-slate-400 text-sm shrink-0">🔍</span>
            <div className="w-24">
              <select
                id="payroll-global-search-year"
                value={tableYearFilter}
                onChange={(e) =>
                  setTableYearFilter(
                    e.target.value === NONE_FILTER_VALUE ? "" : e.target.value,
                  )
                }
                className={`h-9 w-full rounded-lg border border-slate-300 px-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 ${
                  tableYearFilter ? "text-slate-700" : "text-slate-400"
                }`}
              >
                <option value="" hidden>
                  Año
                </option>
                <option value={NONE_FILTER_VALUE} className="text-slate-700">
                  Ninguno
                </option>
                <option value={ALL_FILTER_VALUE} className="text-slate-700">
                  Todos
                </option>
                {tableYearOptions.map((y) => (
                  <option key={y} value={y} className="text-slate-700">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-28">
              <select
                id="payroll-global-search-month"
                value={tableMonthFilter}
                onChange={(e) =>
                  setTableMonthFilter(
                    e.target.value === NONE_FILTER_VALUE ? "" : e.target.value,
                  )
                }
                className={`h-9 w-full rounded-lg border border-slate-300 px-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 ${
                  tableMonthFilter ? "text-slate-700" : "text-slate-400"
                }`}
              >
                <option value="" hidden>
                  Mes
                </option>
                <option value={NONE_FILTER_VALUE} className="text-slate-700">
                  Ninguno
                </option>
                <option value={ALL_FILTER_VALUE} className="text-slate-700">
                  Todos
                </option>
                {PAYROLL_MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1} className="text-slate-700">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full lg:w-64 min-w-[220px]">
              <div className="h-9 flex items-center rounded-lg border border-slate-300 bg-white px-2 shadow-sm focus-within:ring-2 focus-within:ring-slate-200">
                <input
                  id="payroll-global-search-text"
                  type="text"
                  placeholder="Nombre / Nº trabajador"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="payroll-toolbar-search-input w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {isTableFiltered ? (
              <button
                type="button"
                onClick={() => {
                  setTableSearch("");
                  setTableYearFilter("");
                  setTableMonthFilter("");
                }}
                className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800 px-1 py-1"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Buscar nómina</h2>
            </div>
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 rounded-full px-3 py-1.5 disabled:opacity-50"
            >
              {loading ? "Cargando..." : "↻ Actualizar"}
            </button>
          </div>

          <div
            className={`px-6 border-b border-slate-200 bg-slate-50/60 flex flex-wrap gap-3 items-end ${
              hubCompactLookup ? "py-2" : "py-3"
            }`}
          >
            <div className="space-y-1 w-28">
              <label
                htmlFor="payroll-global-search-year"
                className="block text-xs font-medium text-slate-600"
              >
                Año
              </label>
              <select
                id="payroll-global-search-year"
                value={tableYearFilter}
                onChange={(e) => setTableYearFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Todos</option>
                {tableYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 w-36">
              <label
                htmlFor="payroll-global-search-month"
                className="block text-xs font-medium text-slate-600"
              >
                Mes
              </label>
              <select
                id="payroll-global-search-month"
                value={tableMonthFilter}
                onChange={(e) => setTableMonthFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Todos</option>
                {PAYROLL_MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px] space-y-1">
              <label
                htmlFor="payroll-global-search-text"
                className="block text-xs font-medium text-slate-600"
              >
                Trabajador / archivo
              </label>
              <input
                id="payroll-global-search-text"
                type="text"
                placeholder="Nombre, Nº empleado, archivo…"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="payroll-toolbar-search-input w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {isTableFiltered && (
              <button
                type="button"
                onClick={() => {
                  setTableSearch("");
                  setTableYearFilter("");
                  setTableMonthFilter("");
                }}
                className="self-end text-xs font-medium text-slate-500 hover:text-slate-800 underline focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </>
      )}

      {compactToolbar
        ? resultsPortalTarget
          ? createPortal(
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                {resultsContent}
              </div>,
              resultsPortalTarget,
            )
          : null
        : resultsContent}
    </div>
  );
}
