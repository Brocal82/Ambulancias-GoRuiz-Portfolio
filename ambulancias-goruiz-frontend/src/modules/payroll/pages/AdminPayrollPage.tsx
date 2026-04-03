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
} from "../domain/api";
import type {
  PayrollDocument,
  PayrollMatchStatus,
  BatchUploadResponse,
  BatchResultItem,
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
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPayrollPage() {
  const { token } = useAuth();

  // ── data ───────────────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<PayrollDocument[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

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
    "all" | "matched" | "unmatched" | "failed"
  >("all");
  const [batchInputKey, setBatchInputKey] = useState(0);
  // Phase 5c: optional folder-selection mode for the batch input
  const [batchFolderMode, setBatchFolderMode] = useState(false);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // ── inline assign state (docs table) ──────────────────────────────────────
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // ── inline assign state (batch results panel) ──────────────────────────────
  const [batchAssigningPayrollId, setBatchAssigningPayrollId] = useState<
    string | null
  >(null);
  const [batchAssignWorkerId, setBatchAssignWorkerId] = useState("");
  const [batchAssigning, setBatchAssigning] = useState(false);

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
    try {
      await apiUpload({
        file: uploadFile,
        workerId: uploadWorkerId || undefined,
        year,
        month,
      });
      toastT.success("Nómina subida correctamente");
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
      await apiAssign(id, assignWorkerId);
      toastT.success("Nómina asignada correctamente");
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
      await apiAssign(payrollId, batchAssignWorkerId);
      toastT.success("Nómina asignada correctamente");
      setBatchAssigningPayrollId(null);
      setBatchAssignWorkerId("");
      // Optimistically reflect the assignment in the batch results panel.
      // The item flips to "matched" so filters and sort update immediately.
      setBatchResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            unmatched: Math.max(0, prev.summary.unmatched - 1),
            matched: prev.summary.matched + 1,
          },
          results: prev.results.map((item) =>
            item.payrollId === payrollId
              ? { ...item, status: "matched" as const, matchStatus: "manual" as const }
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

  // ── table style (consistent with AdminSickLeavesPage) ─────────────────────
  const thClass =
    "px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600";
  const trClass =
    "border-t border-slate-200 hover:bg-slate-50/70 transition-colors";

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
              <select
                id="upload-worker-id"
                value={uploadWorkerId}
                onChange={(e) => setUploadWorkerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">— Auto-detectar del nombre del archivo —</option>
                {workers.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.lastName}, {w.name}
                    {w.employeeNumber ? ` (${w.employeeNumber})` : ""}
                  </option>
                ))}
              </select>
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

          {/* Mode toggle (Phase 5c) */}
          <label className="inline-flex items-center gap-2 mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={batchFolderMode}
              onChange={(e) => {
                setBatchFolderMode(e.target.checked);
                setBatchFiles([]);
                setBatchInputKey((k) => k + 1);
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">
              Seleccionar carpeta
            </span>
            <span className="text-xs text-slate-400">
              {batchFolderMode
                ? "El navegador mostrará el selector de carpeta. Solo se subirán los PDFs que contenga."
                : "Selección de archivos individuales (por defecto)"}
            </span>
          </label>

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
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "all", label: "Todas", count: batchResults.summary.total },
                    { key: "matched", label: "Asignadas", count: batchResults.summary.matched },
                    { key: "unmatched", label: "Sin asignar", count: batchResults.summary.unmatched },
                    { key: "failed", label: "Con error", count: batchResults.summary.failed },
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
                          item.status === batchResultsFilter,
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
                          className="border-t border-slate-200 hover:bg-slate-50/70"
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
                          </td>

                          {/* Inline assign — only for unmatched rows */}
                          <td className="px-3 py-2 align-top">
                            {item.status === "unmatched" && item.payrollId && (
                              batchAssigningPayrollId === item.payrollId ? (
                                <div className="flex flex-col gap-1.5 min-w-[160px]">
                                  <select
                                    aria-label="Seleccionar trabajador para asignar"
                                    value={batchAssignWorkerId}
                                    onChange={(e) =>
                                      setBatchAssignWorkerId(e.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-blue-100"
                                  >
                                    <option value="">— Seleccionar —</option>
                                    {workers.map((w) => (
                                      <option key={w._id} value={w._id}>
                                        {w.lastName}, {w.name}
                                        {w.employeeNumber
                                          ? ` (${w.employeeNumber})`
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
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
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Cerrar resultados
              </button>
            </div>
          )}
        </div>

        {/* ── Documents table ────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              Documentos subidos{" "}
              <span className="text-slate-500 font-normal">({docs.length})</span>
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

          {loading && docs.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Cargando documentos...
            </div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No hay documentos de nómina todavía.
            </div>
          ) : (
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
                  {docs.map((doc) => (
                    <tr key={doc._id} className={trClass}>

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

                          {/* Assign trigger (unmatched only, not while assigning) */}
                          {doc.matchStatus === "unmatched" &&
                            assigningId !== doc._id && (
                              <button
                                type="button"
                                onClick={() => startAssign(doc._id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100"
                              >
                                Asignar
                              </button>
                            )}

                          {/* Inline assign form */}
                          {assigningId === doc._id && (
                            <div className="flex flex-col gap-1.5 items-stretch min-w-[160px]">
                              <select
                                aria-label="Seleccionar trabajador para asignar"
                                value={assignWorkerId}
                                onChange={(e) =>
                                  setAssignWorkerId(e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-blue-100"
                              >
                                <option value="">— Seleccionar —</option>
                                {workers.map((w) => (
                                  <option key={w._id} value={w._id}>
                                    {w.lastName}, {w.name}
                                    {w.employeeNumber
                                      ? ` (${w.employeeNumber})`
                                      : ""}
                                  </option>
                                ))}
                              </select>
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
