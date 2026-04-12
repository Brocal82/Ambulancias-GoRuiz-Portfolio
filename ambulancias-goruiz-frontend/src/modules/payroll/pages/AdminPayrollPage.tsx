import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import { UsersApi } from "../../users";
import type { User } from "../../users";
import {
  listPayrollDocuments,
  uploadPayrollDocument as apiUpload,
  uploadPayrollBatch as apiBatchUpload,
  assignPayrollDocument as apiAssign,
  checkPayrollCoverage as apiCheckCoverage,
  invalidatePayrollDocument as apiInvalidate,
} from "../domain/api";
import type {
  PayrollDocument,
  PayrollMatchStatus,
  BatchUploadResponse,
  BatchResultItem,
  CoverageCheckResponse,
  DuplicateWarning,
} from "../domain/types";
import FileUpload from "../../../components/common/FileUpload";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Batch results display priority: failed → unmatched → matched.
// Lower number = shown first.
const BATCH_STATUS_ORDER: Record<string, number> = {
  failed: 0,
  unmatched: 1,
  matched: 2,
};

function workerDisplayName(w: PayrollDocument["workerId"]): string {
  if (!w) return "—";
  return `${w.lastName}, ${w.name}`;
}

function periodLabel(year?: number, month?: number): string {
  if (!year && !month) return "—";
  const m = month ? MONTH_NAMES[month - 1] : "";
  return [m, year].filter(Boolean).join(" ");
}

function MatchBadge({ status }: { status: PayrollMatchStatus }) {
  if (status === "matched") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        Auto-asignada
      </span>
    );
  }
  if (status === "unmatched") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        Sin asignar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
      Manual
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkerSearchSelect
// Replaces native <select> with a searchable inline combobox.
// Renders inline (no absolute positioning) so it is safe inside overflow-x-auto
// table wrappers. Value semantics are identical to the original <select>:
// onChange receives a workerId string, or "" for no selection.
// ─────────────────────────────────────────────────────────────────────────────

function WorkerSearchSelect({
  id,
  workers,
  value,
  onChange,
  placeholder = "Buscar por nombre o nº de empleado",
  allowEmpty = false,
  emptyLabel = "Detectar por nombre de archivo",
  size = "default",
}: {
  id?: string;
  workers: User[];
  value: string;
  onChange: (workerId: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  size?: "default" | "sm";
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedWorker = workers.find((w) => w._id === value) ?? null;
  const isCompact = size === "sm";

  // Filter: requires at least one typed character — empty query returns nothing.
  // Max 3 results to keep the list compact.
  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return workers
      .filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.lastName.toLowerCase().includes(q) ||
          (w.employeeNumber ?? "").toLowerCase().includes(q),
      )
      .slice(0, 3);
  })();

  // Reset the search query whenever the parent clears the selection
  // (e.g. after a successful assignment resets the state to "").
  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  const handleSelect = (workerId: string) => {
    onChange(workerId);
    setQuery("");
    setFocused(false);
  };

  // Clear selection and re-open search so the admin can pick again.
  const handleClearAndRefocus = () => {
    onChange("");
    setQuery("");
    setFocused(true);
    // Input re-mounts on next render; focus after the paint.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const inputClass = isCompact
    ? "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-blue-100"
    : "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100";

  // ── Collapsed state: a worker is selected and the field is not being edited ─
  if (selectedWorker && !focused) {
    return (
      <div className="flex items-center gap-1.5 min-w-0 w-full">
        <span
          className={`flex-1 truncate ${isCompact ? "text-xs text-slate-800" : "text-sm text-slate-800"}`}
        >
          <span className="font-medium">
            {selectedWorker.lastName}, {selectedWorker.name}
          </span>
          {selectedWorker.employeeNumber && (
            <span
              className={`ml-1 font-normal text-slate-500 ${isCompact ? "text-[10px]" : "text-xs"}`}
            >
              ({selectedWorker.employeeNumber})
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleClearAndRefocus}
          aria-label="Cambiar trabajador"
          className={`shrink-0 rounded border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors ${
            isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
          }`}
        >
          ✕
        </button>
      </div>
    );
  }

  // ── Search state: input + inline list ────────────────────────────────────────
  return (
    <div className="w-full">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Delay so onMouseDown on list items fires before the list disappears.
          setTimeout(() => {
            setFocused(false);
            setQuery("");
          }, 150);
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={inputClass}
      />
      {/* Panel is only visible when: the user has typed something (search-first),
          OR when allowEmpty=true so the "auto-detect" shortcut is always reachable. */}
      {focused && (query.trim() !== "" || allowEmpty) && (
        <div
          className={`mt-1 rounded-xl border border-slate-200 bg-white overflow-hidden ${
            isCompact ? "" : "shadow-sm"
          }`}
        >
          {/* Optional "no selection / auto-detect" entry — always visible when focused */}
          {allowEmpty && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect("");
              }}
              className={`w-full text-left italic text-slate-400 hover:bg-slate-50 ${
                isCompact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
              }`}
            >
              {emptyLabel}
            </button>
          )}

          {/* Worker results and empty state — only rendered once the user has typed */}
          {query.trim() !== "" && (
            filtered.length === 0 ? (
              <p
                className={`text-slate-400 ${
                  allowEmpty ? "border-t border-slate-100" : ""
                } ${isCompact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
              >
                Sin resultados
              </p>
            ) : (
              <ul>
                {filtered.map((w, i) => (
                  <li key={w._id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(w._id);
                      }}
                      className={`w-full text-left hover:bg-slate-50 ${
                        i > 0 || allowEmpty ? "border-t border-slate-100" : ""
                      } ${isCompact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
                    >
                      <span className="font-medium text-slate-800">
                        {w.lastName}, {w.name}
                      </span>
                      {w.employeeNumber && (
                        <span
                          className={`ml-1.5 text-slate-500 ${
                            isCompact ? "text-[10px]" : "text-xs"
                          }`}
                        >
                          {w.employeeNumber}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPayrollPage() {
  const { token } = useAuth();

  // ── data ───────────────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<PayrollDocument[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // ── working period context ─────────────────────────────────────────────────
  // Drives the Period Context Bar, the header summary, and the document table
  // filter. Each individual form (upload, batch, coverage) remains independent.
  const [workingYear, setWorkingYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [workingMonth, setWorkingMonth] = useState<number>(
    new Date().getMonth() + 1,
  );

  // ── upload form state ──────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadWorkerId, setUploadWorkerId] = useState("");
  const [uploadYear, setUploadYear] = useState<string>(
    String(new Date().getFullYear()),
  );
  const [uploadMonth, setUploadMonth] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  // Incremented after a successful upload to force FileUpload to re-mount and reset
  const [fileInputKey, setFileInputKey] = useState(0);
  // Phase 8b: duplicate warning for the single-file upload path
  const [uploadDuplicateWarning, setUploadDuplicateWarning] =
    useState<DuplicateWarning | null>(null);

  // ── batch upload state (Phase 5) ───────────────────────────────────────────
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchYear, setBatchYear] = useState<string>(
    String(new Date().getFullYear()),
  );
  const [batchMonth, setBatchMonth] = useState<string>("");
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchUploadResponse | null>(
    null,
  );
  const [batchResultsFilter, setBatchResultsFilter] = useState<
    "all" | "matched" | "unmatched" | "failed" | "duplicate"
  >("all");
  const [batchInputKey, setBatchInputKey] = useState(0);
  // Phase 5c: optional folder-selection mode for the batch input
  const [batchFolderMode, setBatchFolderMode] = useState(false);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // ── inline assign state (docs table) ──────────────────────────────────────
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // ── coverage check state (Phase 6b) ───────────────────────────────────────
  // Pre-populated from the working period as a default; admin can change freely.
  // No reactive sync — useState initializer runs once at mount only.
  const [coverageYear, setCoverageYear] = useState<string>(
    String(workingYear),
  );
  const [coverageMonth, setCoverageMonth] = useState<string>(
    String(workingMonth),
  );
  const [coverageChecking, setCoverageChecking] = useState(false);
  const [coverageResult, setCoverageResult] =
    useState<CoverageCheckResponse | null>(null);

  // ── inline assign state (batch results panel) ──────────────────────────────
  const [batchAssigningPayrollId, setBatchAssigningPayrollId] = useState<
    string | null
  >(null);
  const [batchAssignWorkerId, setBatchAssignWorkerId] = useState("");
  const [batchAssigning, setBatchAssigning] = useState(false);

  // ── invalidation state ────────────────────────────────────────────────────
  const [invalidatingId, setInvalidatingId] = useState<string | null>(null);

  // ── docs table filter state ────────────────────────────────────────────────
  const [tableSearch, setTableSearch] = useState("");
  const [tableStatusFilter, setTableStatusFilter] = useState<
    "" | PayrollMatchStatus
  >("");
  // Default to current year/month so the admin sees the relevant period on arrival.
  // "Limpiar filtros" resets them back to "" to show all documents.
  const [tableYearFilter, setTableYearFilter] = useState(
    String(new Date().getFullYear()),
  );
  const [tableMonthFilter, setTableMonthFilter] = useState(
    String(new Date().getMonth() + 1),
  );

  // Keep webkitdirectory attribute in sync with batchFolderMode.
  // React's InputHTMLAttributes does not include webkitdirectory, so we apply
  // it imperatively. The effect re-runs on batchInputKey changes so the
  // attribute is reapplied each time the input is remounted (after reset).
  useEffect(() => {
    const el = batchFileInputRef.current;
    if (!el) return;
    if (batchFolderMode) {
      el.setAttribute("webkitdirectory", "");
    } else {
      el.removeAttribute("webkitdirectory");
    }
  }, [batchFolderMode, batchInputKey]);

  // ── fetch ──────────────────────────────────────────────────────────────────
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
    UsersApi.getAllUsers()
      .then((all) => setWorkers(all.filter((u) => u.role === "worker")))
      .catch(() => toastT.error("Error al cargar los trabajadores"));
  }, [token, fetchDocs]);

  // ── upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile) {
      toastT.warn("Selecciona un archivo PDF antes de subir");
      return;
    }

    const year = uploadYear ? parseInt(uploadYear, 10) : undefined;
    const month = uploadMonth ? parseInt(uploadMonth, 10) : undefined;

    setUploading(true);
    setUploadDuplicateWarning(null);
    try {
      const response = await apiUpload({
        file: uploadFile,
        workerId: uploadWorkerId || undefined,
        year,
        month,
      });
      toastT.success("Nómina subida correctamente");
      setUploadDuplicateWarning(response.possibleDuplicate ?? null);
      setUploadFile(null);
      setUploadWorkerId("");
      setUploadYear(String(new Date().getFullYear()));
      setUploadMonth("");
      setFileInputKey((k) => k + 1);
      await fetchDocs();
    } catch (err) {
      toastT.apiError(err, "Error al subir la nómina");
    } finally {
      setUploading(false);
    }
  };

  // ── batch upload (Phase 5) ─────────────────────────────────────────────────
  const handleBatchUpload = async () => {
    if (batchFiles.length === 0) {
      toastT.warn("Selecciona al menos un archivo PDF antes de subir");
      return;
    }

    const year = batchYear ? parseInt(batchYear, 10) : undefined;
    const month = batchMonth ? parseInt(batchMonth, 10) : undefined;

    setBatchUploading(true);
    setBatchResults(null);
    setBatchResultsFilter("all");
    setBatchAssigningPayrollId(null);
    setBatchAssignWorkerId("");
    try {
      const response = await apiBatchUpload({ files: batchFiles, year, month });
      setBatchResults(response);
      setBatchFiles([]);
      setBatchInputKey((k) => k + 1);
      await fetchDocs();

      const { matched, unmatched, failed, total } = response.summary;
      if (failed === 0 && unmatched === 0) {
        toastT.success(`${matched} de ${total} nóminas asignadas automáticamente`);
      } else if (failed === total) {
        toastT.error("Todos los archivos fallaron. Revisa los errores.");
      } else {
        toastT.warn(
          `Lote procesado: ${matched} asignadas, ${unmatched} sin asignar, ${failed} con error`,
        );
      }
    } catch (err) {
      toastT.apiError(err, "Error al subir el lote de nóminas");
    } finally {
      setBatchUploading(false);
    }
  };

  // ── assign ─────────────────────────────────────────────────────────────────
  const startAssign = (id: string) => {
    setAssigningId(id);
    setAssignWorkerId("");
  };

  const cancelAssign = () => {
    setAssigningId(null);
    setAssignWorkerId("");
  };

  const confirmAssign = async (id: string) => {
    if (!assignWorkerId) {
      toastT.warn("Selecciona un trabajador");
      return;
    }
    setAssigning(true);
    try {
      const response = await apiAssign(id, assignWorkerId);
      toastT.success("Nómina asignada correctamente");
      if (response.possibleDuplicate) {
        toastT.warn(
          `⚠ Posible duplicado detectado: ya existe una nómina confirmada para este trabajador en el mismo período ("${response.possibleDuplicate.originalName}"). El documento se ha guardado.`,
        );
      }
      setAssigningId(null);
      setAssignWorkerId("");
      await fetchDocs();
    } catch (err) {
      toastT.apiError(err, "Error al asignar la nómina");
    } finally {
      setAssigning(false);
    }
  };

  // ── batch inline assign (batch results panel) ─────────────────────────────
  const confirmBatchAssign = async (payrollId: string) => {
    if (!batchAssignWorkerId) {
      toastT.warn("Selecciona un trabajador");
      return;
    }
    setBatchAssigning(true);
    try {
      const response = await apiAssign(payrollId, batchAssignWorkerId);
      toastT.success("Nómina asignada correctamente");
      if (response.possibleDuplicate) {
        toastT.warn(
          `⚠ Posible duplicado detectado: ya existe una nómina confirmada para este trabajador en el mismo período ("${response.possibleDuplicate.originalName}"). El documento se ha guardado.`,
        );
      }
      setBatchAssigningPayrollId(null);
      setBatchAssignWorkerId("");
      // Optimistically reflect the assignment in the batch results panel.
      // The item flips to "matched" so filters and sort update immediately.
      // Also propagate any duplicate warning into the result item and summary.
      setBatchResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            unmatched: Math.max(0, prev.summary.unmatched - 1),
            matched: prev.summary.matched + 1,
            duplicateWarnings:
              (prev.summary.duplicateWarnings ?? 0) +
              (response.possibleDuplicate ? 1 : 0),
          },
          results: prev.results.map((item) =>
            item.payrollId === payrollId
              ? {
                  ...item,
                  status: "matched" as const,
                  matchStatus: "manual" as const,
                  ...(response.possibleDuplicate && {
                    possibleDuplicate: response.possibleDuplicate,
                  }),
                }
              : item,
          ),
        };
      });
      await fetchDocs();
    } catch (err) {
      toastT.apiError(err, "Error al asignar la nómina");
    } finally {
      setBatchAssigning(false);
    }
  };

  // ── coverage check (Phase 6b) ─────────────────────────────────────────────
  const handleCheckCoverage = async () => {
    if (!coverageMonth) {
      toastT.warn("Selecciona un mes para verificar la cobertura");
      return;
    }
    const year = parseInt(coverageYear, 10);
    const month = parseInt(coverageMonth, 10);

    setCoverageChecking(true);
    setCoverageResult(null);
    try {
      const result = await apiCheckCoverage(year, month);
      setCoverageResult(result);
    } catch (err) {
      toastT.apiError(err, "Error al verificar la cobertura de nóminas");
    } finally {
      setCoverageChecking(false);
    }
  };

  // ── file open ──────────────────────────────────────────────────────────────
  const handleOpenFile = async (filename: string, originalName: string) => {
    try {
      // filename is the multer-generated basename; openSecureFile calls
      // GET /api/files/:filename through the authenticated axios instance.
      await openSecureFile(filename, originalName);
    } catch (err) {
      toastT.apiError(err, "Error al abrir el archivo");
    }
  };

  // ── invalidate ─────────────────────────────────────────────────────────────
  const handleInvalidate = async (id: string) => {
    if (
      !window.confirm(
        "¿Eliminar este documento? El archivo se conservará y la acción puede revertirse.",
      )
    )
      return;
    setInvalidatingId(id);
    try {
      await apiInvalidate(id);
      toastT.success("Documento eliminado correctamente");
      await fetchDocs();
    } catch (err) {
      toastT.apiError(err, "Error al eliminar el documento");
    } finally {
      setInvalidatingId(null);
    }
  };

  // ── working period navigation ──────────────────────────────────────────────
  const navigatePeriod = (delta: -1 | 1) => {
    let newMonth = workingMonth + delta;
    let newYear = workingYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setWorkingYear(newYear);
    setWorkingMonth(newMonth);
    // Keep the document table scoped to the new period.
    setTableYearFilter(String(newYear));
    setTableMonthFilter(String(newMonth));
    // Close any open inline assignment — the row may leave the filtered view.
    setAssigningId(null);
    setAssignWorkerId("");
  };

  const resetToCurrentPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    setWorkingYear(year);
    setWorkingMonth(month);
    setTableYearFilter(String(year));
    setTableMonthFilter(String(month));
    setAssigningId(null);
    setAssignWorkerId("");
  };

  // ── docs table: derived filter data ──────────────────────────────────────
  // Unique years present in loaded documents, descending (for the year select).
  // Current year is always included so the pre-selected default renders correctly
  // even before any documents for this year have been uploaded.
  const tableYearOptions = Array.from(
    new Set([
      new Date().getFullYear(),
      // Always include the working year so the select renders correctly even
      // when navigated to a year with no documents yet.
      workingYear,
      ...docs.map((d) => d.year).filter((y): y is number => y !== undefined),
    ]),
  ).sort((a, b) => b - a);

  const isTableFiltered =
    tableSearch.trim() !== "" ||
    tableStatusFilter !== "" ||
    tableYearFilter !== "" ||
    tableMonthFilter !== "";

  const filteredDocs = (isTableFiltered
    ? docs.filter((doc) => {
        if (tableStatusFilter && doc.matchStatus !== tableStatusFilter)
          return false;
        if (tableYearFilter && doc.year !== Number(tableYearFilter))
          return false;
        if (tableMonthFilter && doc.month !== Number(tableMonthFilter))
          return false;
        if (tableSearch.trim()) {
          const q = tableSearch.trim().toLowerCase();
          const inFilename = doc.originalName.toLowerCase().includes(q);
          const inWorkerName = doc.workerId
            ? `${doc.workerId.name} ${doc.workerId.lastName}`
                .toLowerCase()
                .includes(q)
            : false;
          const inEmpNum =
            (doc.workerId?.employeeNumber ?? "").toLowerCase().includes(q) ||
            (doc.parsedEmployeeNumber ?? "").toLowerCase().includes(q);
          if (!inFilename && !inWorkerName && !inEmpNum) return false;
        }
        return true;
      })
    // .slice() creates a copy so the sort below never mutates the docs state array.
    : docs.slice()
  ).sort((a, b) => {
    // Unmatched documents surface first so they are immediately actionable.
    if (a.matchStatus === "unmatched" && b.matchStatus !== "unmatched") return -1;
    if (a.matchStatus !== "unmatched" && b.matchStatus === "unmatched") return 1;
    // Within each status group, preserve the server-side createdAt descending order.
    return 0;
  });

  // ── docs table: render mode ───────────────────────────────────────────────
  // Year selected + no month → group filtered results by month for visual
  // clarity.  Every other combination keeps the existing flat table.
  const renderMode: "flat" | "grouped_by_month" =
    tableYearFilter !== "" && tableMonthFilter === ""
      ? "grouped_by_month"
      : "flat";

  // Groups are computed after filtering, so status / search still apply.
  // Months that have no matching documents after filtering are excluded.
  // Sorted most-recent-month first.
  const groupedByMonth =
    renderMode === "grouped_by_month"
      ? MONTH_NAMES.map((name, i) => ({
          month: i + 1,
          name,
          docs: filteredDocs.filter((d) => d.month === i + 1),
        }))
          .filter((g) => g.docs.length > 0)
          .sort((a, b) => b.month - a.month)
      : [];

  // ── table style (consistent with AdminSickLeavesPage) ─────────────────────
  const thClass =
    "px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600";
  const trClass =
    "border-t border-slate-200 hover:bg-slate-50/70 transition-colors";

  // ── working period: derived helpers ───────────────────────────────────────
  const isCurrentPeriod =
    workingYear === new Date().getFullYear() &&
    workingMonth === new Date().getMonth() + 1;

  // ── header summary: stats for the active working period ───────────────────
  // Uses workingYear/workingMonth so the summary reacts to period bar navigation.
  // On initial load these equal new Date() values — no behavioral difference.
  const summaryYear = workingYear;
  const summaryMonth = workingMonth;
  const summaryMonthName = MONTH_NAMES[summaryMonth - 1];
  const summaryCurrentDocs = docs.filter(
    (d) => d.year === summaryYear && d.month === summaryMonth,
  );
  const summaryConfirmed = summaryCurrentDocs.filter(
    (d) => d.matchStatus === "matched" || d.matchStatus === "manual",
  ).length;
  const summaryPending = summaryCurrentDocs.filter(
    (d) => d.matchStatus === "unmatched",
  ).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Nóminas
          </h1>
          <p className="text-sm text-slate-600">
            Gestión de documentos de nómina por trabajador
          </p>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-slate-700">
              {summaryMonthName} {summaryYear}
            </span>
            {" · "}
            <span className="text-emerald-700">{summaryConfirmed} confirmadas</span>
            {summaryPending > 0 ? (
              <>
                {" · "}
                <span className="font-medium text-amber-600">
                  {summaryPending} pendientes de asignación
                </span>
              </>
            ) : summaryConfirmed > 0 ? (
              <>
                {" · "}
                <span className="text-slate-400">sin pendientes ✓</span>
              </>
            ) : null}
          </p>
        </div>

        {/* ── Period Context Bar ────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 px-5 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigatePeriod(-1)}
            aria-label="Mes anterior"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
          >
            ← Anterior
          </button>

          <div className="flex items-center gap-2.5">
            <span className="text-base font-semibold text-slate-800">
              {summaryMonthName} {workingYear}
            </span>
            {isCurrentPeriod ? (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-200">
                Mes actual
              </span>
            ) : (
              <button
                type="button"
                onClick={resetToCurrentPeriod}
                className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Volver al mes actual
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigatePeriod(1)}
            aria-label="Mes siguiente"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
          >
            Siguiente →
          </button>
        </div>

        {/* ── Upload section ────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">
            Subir documento de nómina
          </h2>

          <div className="flex flex-wrap gap-4 items-end">
            {/* File picker */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Archivo PDF
              </label>
              <FileUpload
                key={fileInputKey}
                id="payroll-pdf-upload"
                label="Seleccionar PDF"
                accept=".pdf,application/pdf"
                maxSizeMB={10}
                onFileSelect={setUploadFile}
                onError={(msg) => toastT.error(msg)}
                hintWhenEmpty="Sin archivo seleccionado"
                showSelectedList
              />
            </div>

            {/* Optional worker selector */}
            <div className="space-y-1 min-w-[200px]">
              <label htmlFor="upload-worker-id" className="block text-sm font-medium text-slate-700">
                Trabajador{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <WorkerSearchSelect
                id="upload-worker-id"
                workers={workers}
                value={uploadWorkerId}
                onChange={setUploadWorkerId}
                placeholder="Buscar por nombre o nº de empleado"
                allowEmpty
                emptyLabel="Detectar por nombre de archivo"
              />
            </div>

            {/* Year */}
            <div className="space-y-1 w-24">
              <label htmlFor="upload-year" className="block text-sm font-medium text-slate-700">
                Año
              </label>
              <input
                id="upload-year"
                type="number"
                value={uploadYear}
                onChange={(e) => setUploadYear(e.target.value)}
                min={2000}
                max={2100}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {/* Month */}
            <div className="space-y-1 w-40">
              <label htmlFor="upload-month" className="block text-sm font-medium text-slate-700">
                Mes{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <select
                id="upload-month"
                value={uploadMonth}
                onChange={(e) => setUploadMonth(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">— Sin especificar —</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !uploadFile}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Subiendo..." : "Subir nómina"}
            </button>
          </div>

          {!uploadWorkerId && (
            <p className="mt-3 text-xs text-slate-500">
              Sin trabajador seleccionado, el sistema intentará asignar
              automáticamente por número de empleado en el nombre del archivo.
            </p>
          )}

          {/* Phase 8b: duplicate warning for single-file upload */}
          {uploadDuplicateWarning && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
              <div className="flex-1 text-xs text-amber-800">
                <span className="font-medium">Posible duplicado detectado.</span>{" "}
                Ya existe una nómina confirmada para este trabajador en el mismo
                período:{" "}
                <span className="font-medium">
                  &ldquo;{uploadDuplicateWarning.originalName}&rdquo;
                </span>
                . El documento se ha guardado igualmente. Revisa la tabla si
                necesitas eliminar el anterior.
              </div>
              <button
                type="button"
                aria-label="Cerrar aviso de duplicado"
                onClick={() => setUploadDuplicateWarning(null)}
                className="shrink-0 text-amber-400 hover:text-amber-600"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* ── Batch upload section (Phase 5) ────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-1">
            Subir múltiples nóminas (lote)
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Selecciona hasta 20 PDFs. El sistema intentará asignar cada archivo
            automáticamente por número de empleado. Los no asignados quedarán
            pendientes de revisión.
          </p>

          {/* Mode toggle (Phase 5c) — segmented control.
              batchFolderMode state, webkitdirectory effect, and reset logic are unchanged. */}
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => {
                  // Only trigger side-effects when the mode is actually changing.
                  if (batchFolderMode) {
                    setBatchFolderMode(false);
                    setBatchFiles([]);
                    setBatchInputKey((k) => k + 1);
                  }
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                  !batchFolderMode
                    ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Archivos
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!batchFolderMode) {
                    setBatchFolderMode(true);
                    setBatchFiles([]);
                    setBatchInputKey((k) => k + 1);
                  }
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                  batchFolderMode
                    ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Carpeta
              </button>
            </div>
            <span className="text-xs text-slate-400">
              {batchFolderMode
                ? "El navegador mostrará el selector de carpeta. Solo se subirán los PDFs que contenga."
                : "Selección de archivos individuales (por defecto)"}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            {/* Native multi-file / folder input */}
            <div className="space-y-1">
              <label
                htmlFor="batch-pdf-upload"
                className="block text-sm font-medium text-slate-700"
              >
                {batchFolderMode ? "Carpeta de nóminas" : "Archivos PDF"}
              </label>
              <input
                key={batchInputKey}
                ref={batchFileInputRef}
                id="batch-pdf-upload"
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  let selected = Array.from(e.target.files ?? []);

                  if (batchFolderMode) {
                    const nonPdf = selected.filter(
                      (f) =>
                        f.type !== "application/pdf" &&
                        !f.name.toLowerCase().endsWith(".pdf"),
                    );
                    if (nonPdf.length > 0) {
                      toastT.warn(
                        `Se ignoraron ${nonPdf.length} archivo${nonPdf.length !== 1 ? "s" : ""} que no son PDF`,
                      );
                    }
                    selected = selected.filter(
                      (f) =>
                        f.type === "application/pdf" ||
                        f.name.toLowerCase().endsWith(".pdf"),
                    );
                  }

                  if (selected.length > 20) {
                    toastT.warn("Máximo 20 archivos por lote");
                    setBatchFiles(selected.slice(0, 20));
                  } else {
                    setBatchFiles(selected);
                  }
                }}
                className="block text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 focus:outline-none"
              />
              {batchFiles.length > 0 && (
                <p className="text-xs text-slate-500">
                  {batchFiles.length} archivo{batchFiles.length !== 1 ? "s" : ""} seleccionado{batchFiles.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Year */}
            <div className="space-y-1 w-24">
              <label
                htmlFor="batch-year"
                className="block text-sm font-medium text-slate-700"
              >
                Año
              </label>
              <input
                id="batch-year"
                type="number"
                value={batchYear}
                onChange={(e) => setBatchYear(e.target.value)}
                min={2000}
                max={2100}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {/* Month */}
            <div className="space-y-1 w-40">
              <label
                htmlFor="batch-month"
                className="block text-sm font-medium text-slate-700"
              >
                Mes{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <select
                id="batch-month"
                value={batchMonth}
                onChange={(e) => setBatchMonth(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">— Sin especificar —</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleBatchUpload}
              disabled={batchUploading || batchFiles.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {batchUploading
                ? "Subiendo..."
                : `Subir ${batchFiles.length > 0 ? batchFiles.length : ""} nómina${batchFiles.length !== 1 ? "s" : ""}`}
            </button>
          </div>

          {/* ── Batch results panel ─────────────────────────────────────────── */}
          {batchResults && (
            <div className="mt-5 space-y-3">
              {/* Summary banner */}
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700 font-medium">
                  Total: {batchResults.summary.total}
                </span>
                {batchResults.summary.matched > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 font-medium ring-1 ring-inset ring-emerald-600/20">
                    ✓ Asignadas: {batchResults.summary.matched}
                  </span>
                )}
                {batchResults.summary.unmatched > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-amber-700 font-medium ring-1 ring-inset ring-amber-600/20">
                    ⚠ Sin asignar: {batchResults.summary.unmatched}
                  </span>
                )}
                {batchResults.summary.failed > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-red-700 font-medium ring-1 ring-inset ring-red-600/20">
                    ✕ Con error: {batchResults.summary.failed}
                  </span>
                )}
                {(batchResults.summary.duplicateWarnings ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-orange-700 font-medium ring-1 ring-inset ring-orange-600/20">
                    ⚠ Posibles duplicados: {batchResults.summary.duplicateWarnings}
                  </span>
                )}
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "all", label: "Todas", count: batchResults.summary.total },
                    { key: "matched", label: "Asignadas", count: batchResults.summary.matched },
                    { key: "unmatched", label: "Sin asignar", count: batchResults.summary.unmatched },
                    { key: "failed", label: "Con error", count: batchResults.summary.failed },
                    { key: "duplicate", label: "Posibles duplicados", count: batchResults.summary.duplicateWarnings ?? 0 },
                  ] as const
                )
                  .filter(({ key, count }) => key === "all" || count > 0)
                  .map(({ key, label, count }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBatchResultsFilter(key)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                        batchResultsFilter === key
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          batchResultsFilter === key
                            ? "bg-white/20 text-white"
                            : "bg-slate-300/60 text-slate-600"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  ))}
              </div>

              {/* Per-file result table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                        Archivo
                      </th>
                      <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600">
                        Resultado
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                        Detalle
                      </th>
                      <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResults.results
                      .filter(
                        (item) =>
                          batchResultsFilter === "all" ||
                          (batchResultsFilter === "duplicate"
                            ? !!item.possibleDuplicate
                            : item.status === batchResultsFilter),
                      )
                      .sort(
                        (a, b) =>
                          (BATCH_STATUS_ORDER[a.status] ?? 99) -
                          (BATCH_STATUS_ORDER[b.status] ?? 99),
                      )
                      .map(
                      (item: BatchResultItem, idx: number) => (
                        <tr
                          key={idx}
                          className={
                            item.status === "unmatched"
                              ? "border-t border-slate-200 bg-amber-50/40 hover:bg-amber-100/50"
                              : "border-t border-slate-200 hover:bg-slate-50/70"
                          }
                        >
                          <td
                            className="px-3 py-2 text-slate-800 font-medium max-w-[240px] truncate"
                            title={item.originalName}
                          >
                            {item.originalName}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.status === "matched" && (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                Auto-asignada
                              </span>
                            )}
                            {item.status === "unmatched" && (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                Sin asignar
                              </span>
                            )}
                            {item.status === "failed" && (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                                Error
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {item.status === "matched" &&
                              item.parsedEmployeeNumber && (
                                <span>
                                  Nº empleado: {item.parsedEmployeeNumber}
                                </span>
                              )}
                            {item.status === "unmatched" && item.matchReason && (
                              <span
                                title={item.matchReason}
                                className="max-w-[280px] block truncate"
                              >
                                {item.matchReason}
                              </span>
                            )}
                            {item.status === "failed" && item.error && (
                              <span className="text-red-600">{item.error}</span>
                            )}
                            {/* Phase 8b: inline duplicate warning */}
                            {item.possibleDuplicate && (
                              <span
                                className="mt-1 inline-flex items-center gap-1 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20"
                                title={`Posible duplicado: "${item.possibleDuplicate.originalName}"`}
                              >
                                ⚠ Posible duplicado
                              </span>
                            )}
                          </td>

                          {/* Inline assign — only for unmatched rows */}
                          <td className="px-3 py-2 align-top">
                            {item.status === "unmatched" && item.payrollId && (
                              batchAssigningPayrollId === item.payrollId ? (
                                <div className="flex flex-col gap-1.5 min-w-[160px]">
                                  <WorkerSearchSelect
                                    workers={workers}
                                    value={batchAssignWorkerId}
                                    onChange={setBatchAssignWorkerId}
                                    size="sm"
                                    placeholder="Buscar trabajador…"
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        confirmBatchAssign(item.payrollId!)
                                      }
                                      disabled={
                                        batchAssigning || !batchAssignWorkerId
                                      }
                                      className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {batchAssigning ? "..." : "Confirmar"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBatchAssigningPayrollId(null);
                                        setBatchAssignWorkerId("");
                                      }}
                                      disabled={batchAssigning}
                                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBatchAssigningPayrollId(item.payrollId!);
                                    setBatchAssignWorkerId("");
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100"
                                >
                                  Asignar
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBatchResults(null);
                  setBatchResultsFilter("all");
                  setBatchAssigningPayrollId(null);
                  setBatchAssignWorkerId("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
              >
                ✕ Cerrar resultados
              </button>
            </div>
          )}
        </div>

        {/* ── Coverage check section (Phase 6b) ─────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-1">
            Verificar cobertura del período
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Muestra los trabajadores <span className="font-medium">activos</span> en la empresa que no tienen
            ningún documento de nómina confirmado para el período seleccionado.
            Trabajadores inactivos no aparecen en esta lista. Los documentos
            históricos de trabajadores inactivos siguen siendo accesibles en la
            tabla de documentos.
          </p>

          <div className="flex flex-wrap gap-4 items-end">
            {/* Year */}
            <div className="space-y-1 w-24">
              <label
                htmlFor="coverage-year"
                className="block text-sm font-medium text-slate-700"
              >
                Año
              </label>
              <input
                id="coverage-year"
                type="number"
                value={coverageYear}
                onChange={(e) => {
                  setCoverageYear(e.target.value);
                  setCoverageResult(null);
                }}
                min={2000}
                max={2100}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {/* Month (required) */}
            <div className="space-y-1 w-44">
              <label
                htmlFor="coverage-month"
                className="block text-sm font-medium text-slate-700"
              >
                Mes{" "}
                <span className="font-normal text-slate-500">(obligatorio)</span>
              </label>
              <select
                id="coverage-month"
                value={coverageMonth}
                onChange={(e) => {
                  setCoverageMonth(e.target.value);
                  setCoverageResult(null);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">— Seleccionar mes —</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleCheckCoverage}
              disabled={coverageChecking || !coverageMonth}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {coverageChecking ? "Verificando..." : "Verificar cobertura"}
            </button>
          </div>

          {/* ── Coverage results ──────────────────────────────────────────────── */}
          {coverageResult && (
            <div className="mt-5 space-y-3">

              {/* Summary line */}
              {coverageResult.totalWorkers === 0 ? (
                <p className="text-sm text-slate-500">
                  No hay trabajadores registrados en la empresa para este período.
                </p>
              ) : coverageResult.missingCount === 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-inset ring-emerald-600/20">
                  <span className="text-emerald-700 font-medium text-sm">
                    ✓ Todos los trabajadores tienen nómina confirmada para{" "}
                    {MONTH_NAMES[coverageResult.period.month - 1]}{" "}
                    {coverageResult.period.year}.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-600/20">
                  <span className="text-amber-800 font-medium text-sm">
                    {coverageResult.missingCount} de{" "}
                    {coverageResult.totalWorkers} trabajadores en el sistema no
                    tienen nómina confirmada para{" "}
                    {MONTH_NAMES[coverageResult.period.month - 1]}{" "}
                    {coverageResult.period.year}.
                  </span>
                </div>
              )}

              {/* Unmatched documents warning */}
              {coverageResult.unmatchedDocumentsForPeriod > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-inset ring-blue-600/20">
                  <span className="text-blue-800 text-xs">
                    <span className="font-semibold">
                      {coverageResult.unmatchedDocumentsForPeriod} documento
                      {coverageResult.unmatchedDocumentsForPeriod !== 1
                        ? "s"
                        : ""}{" "}
                      sin asignar
                    </span>{" "}
                    para este período. Asígnalos manualmente — puede que algunos
                    trabajadores de la lista ya estén cubiertos.
                  </span>
                </div>
              )}

              {/* Missing workers table */}
              {coverageResult.missingCount > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                          Trabajador
                        </th>
                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600">
                          Nº empleado
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverageResult.missingWorkers.map((w) => (
                        <tr
                          key={w._id}
                          className="border-t border-slate-200 hover:bg-slate-50/70"
                        >
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {w.lastName}, {w.name}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-600">
                            {w.employeeNumber ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {w.email}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                onClick={() => setCoverageResult(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
              >
                ✕ Cerrar resultados
              </button>
            </div>
          )}
        </div>

        {/* ── Unmatched attention callout ───────────────────────────────────── */}
        {summaryPending > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
            <div className="flex items-center gap-2.5 text-sm text-amber-800">
              <span className="shrink-0 text-amber-500">⚠</span>
              <span>
                <span className="font-semibold">{summaryPending}</span>{" "}
                documento{summaryPending !== 1 ? "s" : ""} pendiente
                {summaryPending !== 1 ? "s" : ""} de asignación en{" "}
                <span className="font-semibold">
                  {summaryMonthName} {workingYear}
                </span>
                .
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTableYearFilter(String(workingYear));
                setTableMonthFilter(String(workingMonth));
                setTableStatusFilter("unmatched");
                setTableSearch("");
              }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-colors"
            >
              Ver pendientes →
            </button>
          </div>
        )}

        {/* ── Documents table ────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              Documentos subidos{" "}
              <span className="text-slate-500 font-normal">
                {isTableFiltered
                  ? `(${filteredDocs.length} de ${docs.length})`
                  : `(${docs.length})`}
              </span>
            </h2>
            <button
              type="button"
              onClick={fetchDocs}
              disabled={loading}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 rounded-full px-3 py-1.5 disabled:opacity-50"
            >
              {loading ? "Cargando..." : "↻ Actualizar"}
            </button>
          </div>

          {/* ── Table filters ──────────────────────────────────────────────────── */}
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex flex-wrap gap-3 items-end">
            {/* Year */}
            <div className="space-y-1 w-28">
              <label
                htmlFor="table-year"
                className="block text-xs font-medium text-slate-600"
              >
                Año
              </label>
              <select
                id="table-year"
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

            {/* Month */}
            <div className="space-y-1 w-36">
              <label
                htmlFor="table-month"
                className="block text-xs font-medium text-slate-600"
              >
                Mes
              </label>
              <select
                id="table-month"
                value={tableMonthFilter}
                onChange={(e) => setTableMonthFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Todos</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px] space-y-1">
              <label
                htmlFor="table-search"
                className="block text-xs font-medium text-slate-600"
              >
                Buscar
              </label>
              <input
                id="table-search"
                type="search"
                placeholder="Nombre, Nº empleado, archivo…"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {/* Status */}
            <div className="space-y-1 w-44">
              <label
                htmlFor="table-status"
                className="block text-xs font-medium text-slate-600"
              >
                Estado
              </label>
              <select
                id="table-status"
                value={tableStatusFilter}
                onChange={(e) =>
                  setTableStatusFilter(e.target.value as "" | PayrollMatchStatus)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Todos</option>
                <option value="matched">Auto-asignada</option>
                <option value="manual">Manual</option>
                <option value="unmatched">Sin asignar</option>
              </select>
            </div>

            {/* Clear filters */}
            {isTableFiltered && (
              <button
                type="button"
                onClick={() => {
                  setTableSearch("");
                  setTableStatusFilter("");
                  setTableYearFilter("");
                  setTableMonthFilter("");
                }}
                className="self-end text-xs font-medium text-slate-500 hover:text-slate-800 underline focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {loading && docs.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Cargando documentos...
            </div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No hay documentos de nómina todavía.
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Ningún documento coincide con los filtros aplicados.
            </div>
          ) : renderMode === "grouped_by_month" ? (

            /* ── Grouped-by-month view ─────────────────────────────────────────
               Active when a year is selected but no specific month.
               Filtering (status / search) is already applied in filteredDocs;
               each group only contains documents that passed those filters.
               Assignment actions work identically — they use doc._id.        ── */
            <div className="divide-y divide-slate-200">
              {groupedByMonth.map(({ month, name, docs: groupDocs }) => {
                const pendingInGroup = groupDocs.filter(
                  (d) => d.matchStatus === "unmatched",
                ).length;
                return (
                  <div key={month}>

                    {/* Month group header */}
                    <div className="px-6 py-3 bg-slate-50/80 flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">
                        {name} {tableYearFilter}
                      </span>
                      <span className="text-xs text-slate-500">
                        {groupDocs.length}{" "}
                        documento{groupDocs.length !== 1 ? "s" : ""}
                      </span>
                      {pendingInGroup > 0 && (
                        <span className="text-xs font-medium text-amber-600">
                          · {pendingInGroup} pendiente
                          {pendingInGroup !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Sub-table for this month group.
                        thead is not sticky here to avoid multiple sticky bars.
                        "Período" column is omitted — the group header shows it. */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm text-center">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className={`${thClass} text-left`}>Archivo</th>
                            <th className={thClass}>Trabajador</th>
                            <th className={thClass}>Estado</th>
                            <th className={thClass}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                          {groupDocs.map((doc) => (
                            <tr
                              key={doc._id}
                              className={
                                doc.matchStatus === "unmatched"
                                  ? "border-t border-slate-200 !bg-amber-50/40 hover:bg-amber-100/50 transition-colors"
                                  : trClass
                              }
                            >
                              {/* Filename + parsed employee number hint */}
                              <td className="px-3 py-2 text-left align-top">
                                <span
                                  className="block text-slate-800 font-medium truncate max-w-[220px]"
                                  title={doc.originalName}
                                >
                                  {doc.originalName}
                                </span>
                                {doc.parsedEmployeeNumber && (
                                  <span className="text-xs text-slate-500">
                                    Nº empleado detectado:{" "}
                                    {doc.parsedEmployeeNumber}
                                  </span>
                                )}
                              </td>

                              {/* Assigned worker */}
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

                              {/* Match status + unmatched reason */}
                              <td className="px-3 py-2 align-top">
                                <MatchBadge status={doc.matchStatus} />
                                {doc.matchStatus === "unmatched" &&
                                  doc.matchReason && (
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

                              {/* Actions */}
                              <td className="px-3 py-2 align-top">
                                <div className="flex flex-col items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenFile(
                                        doc.filename,
                                        doc.originalName,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                  >
                                    📄 Ver
                                  </button>
                                  {assigningId !== doc._id && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startAssign(doc._id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100"
                                      >
                                        {doc.matchStatus === "unmatched" ? "Asignar" : "Re-asignar"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleInvalidate(doc._id)}
                                        disabled={invalidatingId === doc._id}
                                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {invalidatingId === doc._id ? "..." : "Eliminar"}
                                      </button>
                                    </>
                                  )}
                                  {assigningId === doc._id && (
                                    <div className="flex flex-col gap-1.5 items-stretch min-w-[160px]">
                                      <WorkerSearchSelect
                                        workers={workers}
                                        value={assignWorkerId}
                                        onChange={setAssignWorkerId}
                                        size="sm"
                                        placeholder="Buscar trabajador…"
                                      />
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            confirmAssign(doc._id)
                                          }
                                          disabled={
                                            assigning || !assignWorkerId
                                          }
                                          className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {assigning ? "..." : "Confirmar"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelAssign}
                                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

          ) : (

            /* ── Flat table view (unchanged) ───────────────────────────────────
               Active for all other filter combinations:
               month selected, search only, status only, no filters, etc.   ── */
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-center">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="border-b border-slate-200">
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
                          // !bg overrides the <tbody> nth-child zebra selector which
                          // would otherwise win on odd rows due to higher specificity.
                          ? "border-t border-slate-200 !bg-amber-50/40 hover:bg-amber-100/50 transition-colors"
                          : trClass
                      }
                    >

                      {/* Original filename + parsed employee number hint */}
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

                      {/* Assigned worker */}
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

                      {/* Match status + reason for unmatched */}
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

                      {/* Period */}
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {periodLabel(doc.year, doc.month) !== "—" ? (
                          periodLabel(doc.year, doc.month)
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions: open file + assign (for unmatched) */}
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col items-center gap-2">

                          {/* Secure file open */}
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenFile(doc.filename, doc.originalName)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                          >
                            📄 Ver
                          </button>

                          {/* Assign / re-assign + Eliminar (all statuses, not while assigning) */}
                          {assigningId !== doc._id && (
                            <>
                              <button
                                type="button"
                                onClick={() => startAssign(doc._id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100"
                              >
                                {doc.matchStatus === "unmatched" ? "Asignar" : "Re-asignar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInvalidate(doc._id)}
                                disabled={invalidatingId === doc._id}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {invalidatingId === doc._id ? "..." : "Eliminar"}
                              </button>
                            </>
                          )}

                          {/* Inline assign form */}
                          {assigningId === doc._id && (
                            <div className="flex flex-col gap-1.5 items-stretch min-w-[160px]">
                              <WorkerSearchSelect
                                workers={workers}
                                value={assignWorkerId}
                                onChange={setAssignWorkerId}
                                size="sm"
                                placeholder="Buscar trabajador…"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => confirmAssign(doc._id)}
                                  disabled={assigning || !assignWorkerId}
                                  className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {assigning ? "..." : "Confirmar"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelAssign}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
