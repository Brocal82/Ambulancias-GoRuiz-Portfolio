import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import { UsersApi } from "../../users";
import type { User } from "../../users";
import {
  listPayrollDocuments,
  checkPayrollCoverage as apiCheckPayrollCoverage,
  uploadPayrollDocument as apiUpload,
  uploadPayrollBatch as apiBatchUpload,
  assignPayrollDocument as apiAssign,
  invalidatePayrollDocument as apiInvalidate,
} from "../domain/api";
import { matchesPayrollDocumentText } from "../domain/predicates";
import type {
  PayrollDocument,
  BatchUploadResponse,
  DuplicateWarning,
  CoverageWorker,
} from "../domain/types";
import { PAYROLL_MONTH_NAMES } from "../domain/constants";
import FileUpload from "../../../components/common/FileUpload";
import PayrollUploadTriggerButton from "../../../components/common/actions/PayrollUploadTriggerButton";
import SendIconButton from "../../../components/common/actions/SendIconButton";
import PayrollCompletionSnapshot from "../components/PayrollCompletionSnapshot";
import ResolutionWorkspace from "../components/ResolutionWorkspace";
import MatchBadge from "../components/MatchBadge";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function workerDisplayName(w: PayrollDocument["workerId"]): string {
  if (!w) return "—";
  return `${w.lastName}, ${w.name}`;
}

function mapCoverageWorkerToUser(worker: CoverageWorker): User {
  return {
    _id: worker._id,
    name: worker.name,
    lastName: worker.lastName,
    email: worker.email,
    role: "worker",
    employeeNumber: worker.employeeNumber ?? undefined,
  };
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
  dropdownOverlay = false,
}: {
  id?: string;
  workers: User[];
  value: string;
  onChange: (workerId: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  size?: "default" | "sm";
  dropdownOverlay?: boolean;
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
          className={`shrink-0 rounded border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors ${isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
            }`}
        >
          ✕
        </button>
      </div>
    );
  }

  // ── Search state: input + inline list ────────────────────────────────────────
  return (
    <div className={`w-full ${dropdownOverlay ? "relative" : ""}`}>
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
          className={`${dropdownOverlay ? "absolute left-0 right-0 top-full mt-1 z-20" : "mt-1"} rounded-xl border border-slate-200 bg-white overflow-hidden ${isCompact ? "" : "shadow-sm"
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
              className={`w-full text-left italic text-slate-400 hover:bg-slate-50 ${isCompact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
                }`}
            >
              {emptyLabel}
            </button>
          )}

          {/* Worker results and empty state — only rendered once the user has typed */}
          {query.trim() !== "" && (
            filtered.length === 0 ? (
              <p
                className={`text-slate-400 ${allowEmpty ? "border-t border-slate-100" : ""
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
                      className={`w-full text-left hover:bg-slate-50 ${i > 0 || allowEmpty ? "border-t border-slate-100" : ""
                        } ${isCompact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
                    >
                      <span className="font-medium text-slate-800">
                        {w.lastName}, {w.name}
                      </span>
                      {w.employeeNumber && (
                        <span
                          className={`ml-1.5 text-slate-500 ${isCompact ? "text-[10px]" : "text-xs"
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
  const navigate = useNavigate();
  const { year: yearParam, month: monthParam } = useParams<{
    year: string;
    month: string;
  }>();

  // ── data ───────────────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<PayrollDocument[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);
  const [coverageMissingWorkers, setCoverageMissingWorkers] = useState<User[] | null>(null);
  const [coverageTotalWorkers, setCoverageTotalWorkers] = useState<number | null>(
    null,
  );

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
  const [uploadMonth, setUploadMonth] = useState<string>(
    String(new Date().getMonth() + 1),
  );
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
  const [batchMonth, setBatchMonth] = useState<string>(
    String(new Date().getMonth() + 1),
  );
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchUploadResponse | null>(
    null,
  );
  const [batchInputKey, setBatchInputKey] = useState(0);
  // Phase 5c: optional folder-selection mode for the batch input
  const [batchFolderMode, setBatchFolderMode] = useState(false);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadPanel, setActiveUploadPanel] = useState<
    "none" | "single" | "batch"
  >("none");

  // ── inline assign state (docs table) ──────────────────────────────────────
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // ── invalidation state ────────────────────────────────────────────────────
  const [invalidatingId, setInvalidatingId] = useState<string | null>(null);

  /** Monthly documents list under PayrollCompletionSnapshot (collapsed by default). */
  const [monthlyDocsListExpanded, setMonthlyDocsListExpanded] = useState(false);
  /** View mode for the monthly documents list. */
  const [monthlyDocsListMode, setMonthlyDocsListMode] = useState<"all" | "unassigned">("all");
  /** Unified reconciliation workspace visibility. */
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  /** Local filter for the expanded monthly list only (current month docs). */
  const [monthlyListFilter, setMonthlyListFilter] = useState("");

  const workersMissingSectionRef = useRef<HTMLDivElement>(null);
  const [highlightWorkersMissing] = useState(false);

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

  // Collapse monthly doc list when the working month has no documents (e.g. last doc removed).
  useEffect(() => {
    const count = docs.filter(
      (d) => d.year === workingYear && d.month === workingMonth,
    ).length;
    if (count === 0) {
      setMonthlyDocsListExpanded(false);
      setMonthlyDocsListMode("all");
    }
  }, [docs, workingYear, workingMonth]);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    try {
      const data = await listPayrollDocuments();
      setDocs(data);
    } catch (err) {
      toastT.apiError(err, "Error al cargar los documentos de nómina");
    }
  }, []);

  const activateUnassignedPayrollsFilter = useCallback(() => {
    const hasCurrentDocs = docs.some(
      (d) => d.year === workingYear && d.month === workingMonth,
    );
    if (!hasCurrentDocs) return;
    setMonthlyDocsListExpanded(true);
    setMonthlyDocsListMode("unassigned");
  }, [docs, workingYear, workingMonth]);

  const navigateToUnassignedPayrolls = useCallback(() => {
    if (reconciliationOpen) {
      setReconciliationOpen(false);
      setMonthlyDocsListExpanded(false);
      setMonthlyDocsListMode("all");
      setMonthlyListFilter("");
      return;
    }
    setReconciliationOpen(true);
    activateUnassignedPayrollsFilter();
  }, [
    reconciliationOpen,
    activateUnassignedPayrollsFilter,
  ]);

  useEffect(() => {
    if (!token) return;
    void fetchDocs();
    UsersApi.getAllUsers()
      .then((all) => setWorkers(all.filter((u) => u.role === "worker")))
      .catch(() => toastT.error("Error al cargar los trabajadores"));
  }, [token, fetchDocs]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setCoverageMissingWorkers(null);
    setCoverageTotalWorkers(null);

    void apiCheckPayrollCoverage(workingYear, workingMonth)
      .then((coverage) => {
        if (cancelled) return;
        setCoverageMissingWorkers(
          coverage.missingWorkers.map(mapCoverageWorkerToUser),
        );
        setCoverageTotalWorkers(coverage.totalWorkers);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep existing local fallback if payroll coverage check fails.
        setCoverageMissingWorkers(null);
        setCoverageTotalWorkers(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token, workingYear, workingMonth]);

  // Initialize / sync workspace from route: /admin/payroll/month/:year/:month
  useEffect(() => {
    if (!yearParam || !monthParam) return;
    const y = parseInt(yearParam, 10);
    const m = parseInt(monthParam, 10);
    if (
      Number.isNaN(y) ||
      Number.isNaN(m) ||
      m < 1 ||
      m > 12 ||
      y < 2000 ||
      y > 2100
    )
      return;
    setWorkingYear(y);
    setWorkingMonth(m);
    setBatchYear(String(y));
    setBatchMonth(String(m));
    setUploadYear(String(y));
    setUploadMonth(String(m));
    setAssigningId(null);
    setAssignWorkerId("");
    setMonthlyDocsListExpanded(false);
    setMonthlyDocsListMode("all");
    setReconciliationOpen(false);
    setMonthlyListFilter("");
    setActiveUploadPanel("none");
  }, [yearParam, monthParam]);

  // ── upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile) {
      toastT.warn("Selecciona un archivo PDF antes de subir");
      return;
    }

    if (!uploadYear) {
      toastT.warn("Selecciona un año para la nómina");
      return;
    }
    if (!uploadMonth) {
      toastT.warn("Selecciona un mes para la nómina");
      return;
    }

    const year = parseInt(uploadYear, 10);
    const month = parseInt(uploadMonth, 10);

    setUploading(true);
    setUploadDuplicateWarning(null);
    try {
      const response = await apiUpload({
        file: uploadFile,
        workerId: uploadWorkerId || undefined,
        year,
        month,
      });
      if (response.status === "skipped_duplicate") {
        toastT.warn(
          "Nómina ignorada: ya existe un documento confirmado duplicado para este período.",
        );
        setUploadDuplicateWarning(null);
        return;
      }
      toastT.success("Nómina subida correctamente");
      setUploadDuplicateWarning(response.possibleDuplicate ?? null);
      setUploadFile(null);
      setUploadWorkerId("");
      setUploadYear(String(new Date().getFullYear()));
      setUploadMonth(String(new Date().getMonth() + 1));
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

    if (!batchYear) {
      toastT.warn("Selecciona un año para el lote");
      return;
    }
    if (!batchMonth) {
      toastT.warn("Selecciona un mes para el lote");
      return;
    }

    const year = parseInt(batchYear, 10);
    const month = parseInt(batchMonth, 10);

    setBatchUploading(true);
    setBatchResults(null);
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
    setAssigningId(null);
    setAssignWorkerId("");
    setMonthlyDocsListExpanded(false);
    setMonthlyDocsListMode("all");
    setReconciliationOpen(false);
    setMonthlyListFilter("");
    navigate(`/admin/payroll/month/${newYear}/${newMonth}`, { replace: true });
  };

  const resetToCurrentPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    setWorkingYear(year);
    setWorkingMonth(month);
    setAssigningId(null);
    setAssignWorkerId("");
    setMonthlyDocsListExpanded(false);
    setMonthlyDocsListMode("all");
    setReconciliationOpen(false);
    setMonthlyListFilter("");
    setActiveUploadPanel("none");
    navigate(`/admin/payroll/month/${year}/${month}`, { replace: true });
  };

  const toggleUploadPanel = (panel: "single" | "batch") => {
    setActiveUploadPanel((current) => (current === panel ? "none" : panel));
  };

  // ── monthly documents table (compact; aligned with Year Hub search table) ─
  const monthlyTh =
    "py-1 text-xs font-medium text-slate-600";
  const monthlyTr =
    "transition-colors hover:bg-slate-50/70";
  const monthlyTrUnmatched =
    "bg-amber-50/35 hover:bg-amber-50/50 transition-colors";

  // ── working period: derived helpers ───────────────────────────────────────
  const isCurrentPeriod =
    workingYear === new Date().getFullYear() &&
    workingMonth === new Date().getMonth() + 1;

  // ── header summary: stats for the active working period ───────────────────
  // Uses workingYear/workingMonth so the summary reacts to period bar navigation.
  // On initial load these equal new Date() values — no behavioral difference.
  const summaryYear = workingYear;
  const summaryMonth = workingMonth;
  const summaryMonthName = PAYROLL_MONTH_NAMES[summaryMonth - 1];
  const summaryCurrentDocs = docs.filter(
    (d) => d.year === summaryYear && d.month === summaryMonth,
  );
  const hasSummaryPayrollDocs = summaryCurrentDocs.length > 0;
  const summaryConfirmed = summaryCurrentDocs.filter(
    (d) => d.matchStatus === "matched" || d.matchStatus === "manual",
  ).length;
  const summaryPending = summaryCurrentDocs.filter(
    (d) => d.matchStatus === "unmatched",
  ).length;
  const summaryCoveredWorkers = new Set(
    summaryCurrentDocs
      .filter(
        (d) =>
          (d.matchStatus === "matched" || d.matchStatus === "manual") &&
          d.workerId?._id,
      )
      .map((d) => d.workerId!._id),
  ).size;
  const assignedWorkerIdsForSummaryPeriod = new Set(
    summaryCurrentDocs
      .filter(
        (d) =>
          (d.matchStatus === "matched" || d.matchStatus === "manual") &&
          d.workerId?._id,
      )
      .map((d) => d.workerId!._id),
  );
  const localMissingWorkersForSummaryPeriod = hasSummaryPayrollDocs
    ? workers.filter((w) => !assignedWorkerIdsForSummaryPeriod.has(w._id))
    : [];
  const missingWorkersForSummaryPeriod = hasSummaryPayrollDocs
    ? (coverageMissingWorkers ?? localMissingWorkersForSummaryPeriod)
    : [];
  const totalWorkersForSummaryPeriod = coverageTotalWorkers ?? workers.length;
  const monthlySortedDocs = [...summaryCurrentDocs].sort((a, b) => {
    if (a.matchStatus === "unmatched" && b.matchStatus !== "unmatched") return -1;
    if (a.matchStatus !== "unmatched" && b.matchStatus === "unmatched") return 1;
    return 0;
  });

  const monthlyBaseDocs =
    monthlyDocsListMode === "unassigned"
      ? monthlySortedDocs.filter((doc) => doc.matchStatus === "unmatched")
      : monthlySortedDocs;
  const monthlyListFilterTrim = monthlyListFilter.trim().toLowerCase();
  const monthlyFilteredDocs = monthlyListFilterTrim
    ? monthlyBaseDocs.filter((doc) => {
      return matchesPayrollDocumentText(doc, monthlyListFilterTrim);
    })
    : monthlyBaseDocs;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Link
            to="/admin/payroll/nominas"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
          >
            ← Resumen anual
          </Link>
        </div>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Nóminas · {summaryMonthName} {summaryYear}
          </h1>
        </div>

        {/* ── Period Context Bar ────────────────────────────────────────────── */}
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 px-3 py-2">
            <button
              type="button"
              onClick={() => navigatePeriod(-1)}
              aria-label="Mes anterior"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
            >
              ←
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {summaryMonthName} {workingYear}
              </span>
              {isCurrentPeriod ? (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 ring-1 ring-inset ring-blue-200">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
            >
              →
            </button>
          </div>
          <div className="ml-auto flex w-full items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => toggleUploadPanel("single")}
              aria-label="Subir individual"
              title="Subir individual"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-lg leading-none shadow-sm cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-slate-200 ${activeUploadPanel === "single"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
            >
              <span aria-hidden="true">📄</span>
            </button>
            <button
              type="button"
              onClick={() => toggleUploadPanel("batch")}
              aria-label="Subir lote"
              title="Subir lote"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-base leading-none shadow-sm cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-slate-200 ${activeUploadPanel === "batch"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
            >
              <span aria-hidden="true" className="inline-flex items-center gap-0.5">
                <span>📁</span>
              </span>
            </button>
          </div>
        </div>

        <PayrollCompletionSnapshot
          totalPayrollDocs={summaryCurrentDocs.length}
          assignedPayrollDocs={summaryConfirmed}
          unassignedPayrollDocs={summaryPending}
          coveredWorkers={summaryCoveredWorkers}
          totalWorkers={totalWorkersForSummaryPeriod}
          workersMissingPayroll={missingWorkersForSummaryPeriod.length}
          onClick={() => {
            if (summaryCurrentDocs.length === 0) return;
            if (reconciliationOpen) {
              setReconciliationOpen(false);
              setMonthlyDocsListExpanded(true);
              setMonthlyDocsListMode("all");
              return;
            }
            const nextExpanded = !monthlyDocsListExpanded;
            setMonthlyDocsListExpanded(nextExpanded);
            setMonthlyDocsListMode("all");
          }}
          monthlyListExpanded={monthlyDocsListExpanded && !reconciliationOpen}
          onToggleReconciliation={navigateToUnassignedPayrolls}
          reconciliationOpen={reconciliationOpen}
        />

        {activeUploadPanel === "single" ? (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Subir 1 nómina
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-end lg:gap-4">
              <div className="shrink-0 lg:mr-6">
                <FileUpload
                  key={fileInputKey}
                  id="payroll-pdf-upload"
                  label="Subir nómina"
                  accept=".pdf,application/pdf"
                  maxSizeMB={10}
                  onFileSelect={setUploadFile}
                  onError={(msg) => toastT.error(msg)}
                  hintWhenEmpty="Sin archivo seleccionado"
                  showSelectedList={false}
                  useUploadActionTrigger
                  uploadActionMode="single"
                />
              </div>
              <div className="flex items-end gap-2.5 min-w-0">
                <div className="space-y-1 min-w-[160px] w-[190px]">
                  <label
                    htmlFor="upload-worker-id"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Trabajador
                  </label>
                  <WorkerSearchSelect
                    id="upload-worker-id"
                    workers={workers}
                    value={uploadWorkerId}
                    onChange={setUploadWorkerId}
                    placeholder="Nombre/Nº trabajador"
                    dropdownOverlay
                  />
                </div>
                <div className="space-y-1 w-20 shrink-0">
                  <label
                    htmlFor="upload-year"
                    className="block text-sm font-medium text-slate-700"
                  >
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
                <div className="space-y-1 w-32 shrink-0">
                  <label
                    htmlFor="upload-month"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Mes
                  </label>
                  <select
                    id="upload-month"
                    value={uploadMonth}
                    onChange={(e) => setUploadMonth(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">— Seleccionar mes —</option>
                    {PAYROLL_MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="w-full lg:w-auto lg:ml-6 flex items-center gap-3 lg:justify-end">
                <div
                  className={`w-[220px] min-w-[180px] max-w-[260px] text-right text-xs leading-tight truncate ${uploadFile ? "text-blue-600 font-medium" : "text-slate-500"
                    }`}
                  title={uploadFile?.name ?? "Sin archivo seleccionado"}
                >
                  {uploadFile ? uploadFile.name : "Sin archivo seleccionado"}
                </div>
                {uploadFile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFile(null);
                      setFileInputKey((k) => k + 1);
                    }}
                    aria-label="Quitar archivo seleccionado"
                    title="Quitar archivo"
                    className="shrink-0 text-red-400 hover:text-red-600 text-sm leading-none cursor-pointer"
                  >
                    ✕
                  </button>
                ) : null}
                <SendIconButton
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile || !uploadYear || !uploadMonth}
                  title={uploading ? "Subiendo nómina..." : "Subir nómina"}
                  className="shrink-0"
                />
              </div>
            </div>

            {uploadDuplicateWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
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
        ) : null}

        {activeUploadPanel === "batch" ? (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">
              Subir múltiples nóminas (lote)
            </h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (batchFolderMode) {
                      setBatchFolderMode(false);
                      setBatchFiles([]);
                      setBatchInputKey((k) => k + 1);
                    }
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${!batchFolderMode
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
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${batchFolderMode
                    ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  Carpeta
                </button>
              </div>
            </div>
            <div className="flex flex-wrap lg:flex-nowrap items-end gap-4">
              <div className="shrink-0">
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
                      selected = selected.slice(0, 20);
                    }

                    // Accumulate selections across multiple picker openings.
                    // Keep existing behavior: cap the final batch at 20 files.
                    setBatchFiles((prev) => {
                      const merged = [...prev, ...selected];
                      if (merged.length > 20) {
                        toastT.warn("Máximo 20 archivos por lote");
                        return merged.slice(0, 20);
                      }
                      return merged;
                    });

                    // Allow selecting the same file(s) again in a new picker opening.
                    if (e.currentTarget) {
                      e.currentTarget.value = "";
                    }
                  }}
                  className="sr-only"
                />
                <PayrollUploadTriggerButton
                  mode={batchFolderMode ? "folder" : "files"}
                  onClick={() => {
                    batchFileInputRef.current?.click();
                  }}
                  label={batchFolderMode ? "Subir carpeta" : "Subir varias"}
                />
              </div>
              <div className="flex items-end gap-2.5 min-w-0">
                <div className="space-y-1 w-24 shrink-0">
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
                <div className="space-y-1 w-36 shrink-0">
                  <label
                    htmlFor="batch-month"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Mes
                  </label>
                  <select
                    id="batch-month"
                    value={batchMonth}
                    onChange={(e) => setBatchMonth(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">— Seleccionar mes —</option>
                    {PAYROLL_MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="w-full lg:w-auto lg:ml-auto flex items-center gap-3 lg:justify-end">
                <div
                  className={`w-[220px] min-w-[180px] max-w-[260px] text-right text-xs leading-tight truncate ${batchFiles.length > 0 ? "text-blue-600 font-medium" : "text-slate-500"}`}
                  title={
                    batchFiles.length > 0
                      ? `${batchFiles.length} archivo${batchFiles.length !== 1 ? "s" : ""} seleccionado${batchFiles.length !== 1 ? "s" : ""}`
                      : "Sin archivos seleccionados"
                  }
                >
                  {batchFiles.length > 0
                    ? `${batchFiles.length} archivo${batchFiles.length !== 1 ? "s" : ""} seleccionado${batchFiles.length !== 1 ? "s" : ""}`
                    : "Sin archivos seleccionados"}
                </div>
                {batchFiles.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setBatchFiles([])}
                    aria-label="Quitar archivos seleccionados"
                    title="Quitar archivos"
                    className="shrink-0 text-red-400 hover:text-red-600 text-sm leading-none cursor-pointer"
                  >
                    ✕
                  </button>
                ) : null}
                <SendIconButton
                  onClick={handleBatchUpload}
                  disabled={
                    batchUploading ||
                    batchFiles.length === 0 ||
                    !batchYear ||
                    !batchMonth
                  }
                  title={
                    batchUploading
                      ? "Subiendo lote..."
                      : `Subir ${batchFiles.length > 0 ? batchFiles.length : ""} nómina${batchFiles.length !== 1 ? "s" : ""}`
                  }
                  className="shrink-0"
                />
              </div>
            </div>
            {batchResults && (
              <div className="mt-5 space-y-3">
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
                <button
                  type="button"
                  onClick={() => {
                    setBatchResults(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                >
                  ✕ Cerrar resultados
                </button>
              </div>
            )}
          </div>
        ) : null}

        {monthlyDocsListExpanded && monthlySortedDocs.length > 0 ? (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/95">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100 leading-tight">
                    {reconciliationOpen
                      ? "Nominas sin asignar"
                      : `Documentos del mes (${summaryMonthName} ${summaryYear})`}
                  </h2>
                </div>
                <input
                  id="monthly-docs-filter"
                  type="search"
                  placeholder="Buscar por trabajador, numero o archivo"
                  value={monthlyListFilter}
                  onChange={(e) => setMonthlyListFilter(e.target.value)}
                  className="w-full sm:w-72 rounded-md border border-slate-300 px-2 py-1 text-[11px] bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {monthlyDocsListMode === "unassigned" && !reconciliationOpen ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Mostrando solo nóminas sin asignar
                  </span>
                  <button
                    type="button"
                    onClick={() => setMonthlyDocsListMode("all")}
                    className="text-[11px] font-medium text-slate-600 hover:text-slate-800 underline underline-offset-2"
                  >
                    Ver todas
                  </button>
                </div>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className={`${monthlyTh} px-3 text-left`}>
                      Nombre trabajador
                    </th>
                    <th
                      className={`${monthlyTh} px-2 whitespace-nowrap text-left`}
                    >
                      Nº empleado
                    </th>
                    <th className={`${monthlyTh} px-2 text-left`}>Archivo</th>
                    <th
                      className={`${monthlyTh} px-2 text-center whitespace-nowrap`}
                    >
                      Estado
                    </th>
                    <th
                      className={`${monthlyTh} px-2 text-center whitespace-nowrap min-w-[14rem]`}
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyFilteredDocs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-5 text-center text-xs text-slate-500"
                      >
                        Ningún documento coincide con el filtro.
                      </td>
                    </tr>
                  ) : null}
                  {monthlyFilteredDocs.map((doc) => {
                    const name = workerDisplayName(doc.workerId);
                    const empNum =
                      doc.workerId?.employeeNumber ?? doc.parsedEmployeeNumber;
                    return (
                      <tr
                        key={doc._id}
                        className={
                          doc.matchStatus === "unmatched"
                            ? monthlyTrUnmatched
                            : monthlyTr
                        }
                      >
                        <td
                          className="px-3 py-1.5 text-slate-800 align-middle max-w-[200px] truncate"
                          title={name === "—" ? doc.originalName : undefined}
                        >
                          {name}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap tabular-nums align-middle">
                          {empNum ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 align-middle min-w-[10rem] max-w-[22rem]">
                          <span
                            className="text-slate-800 font-medium break-words leading-snug"
                            title={doc.originalName}
                          >
                            {doc.originalName}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center align-middle">
                          <MatchBadge status={doc.matchStatus} />
                        </td>
                        <td
                          className={`px-2 py-1.5 align-middle ${assigningId !== doc._id ? "whitespace-nowrap" : ""
                            }`}
                        >
                          {assigningId !== doc._id ? (
                            <div className="flex flex-row flex-nowrap items-center justify-center gap-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenFile(doc.filename, doc.originalName)
                                }
                                className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              >
                                Ver
                              </button>
                              <button
                                type="button"
                                onClick={() => startAssign(doc._id)}
                                className="inline-flex shrink-0 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-100"
                              >
                                {doc.matchStatus === "unmatched"
                                  ? "Asignar"
                                  : "Re-asignar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInvalidate(doc._id)}
                                disabled={invalidatingId === doc._id}
                                className="inline-flex shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {invalidatingId === doc._id
                                  ? "..."
                                  : "Eliminar"}
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 items-stretch min-w-[160px] max-w-[240px] mx-auto">
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
                                  className="flex-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {assigning ? "..." : "Confirmar"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelAssign}
                                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {reconciliationOpen ? (
          <ResolutionWorkspace
            missingWorkers={missingWorkersForSummaryPeriod}
            workersMissingSectionRef={workersMissingSectionRef}
            highlightWorkersMissing={highlightWorkersMissing}
          />
        ) : null}

      </div>
    </div>
  );
}
