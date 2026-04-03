import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import { UsersApi } from "../../users";
import type { User } from "../../users";
import {
  listPayrollDocuments,
  uploadPayrollDocument as apiUpload,
  assignPayrollDocument as apiAssign,
} from "../domain/api";
import type { PayrollDocument, PayrollMatchStatus } from "../domain/types";
import FileUpload from "../../../components/common/FileUpload";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

  // ── inline assign state ────────────────────────────────────────────────────
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assigning, setAssigning] = useState(false);

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
              <label className="block text-sm font-medium text-slate-700">
                Trabajador{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <select
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
              <label className="block text-sm font-medium text-slate-700">
                Año
              </label>
              <input
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
              <label className="block text-sm font-medium text-slate-700">
                Mes{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <select
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
