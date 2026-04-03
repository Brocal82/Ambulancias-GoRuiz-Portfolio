import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import { listMyPayrollDocuments } from "../domain/api";
import type { WorkerPayrollDocument } from "../domain/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function periodLabel(year?: number, month?: number): string {
  if (!year && !month) return "—";
  const m = month ? MONTH_NAMES[month - 1] : "";
  return [m, year].filter(Boolean).join(" ");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkerPayrollPage() {
  const { token } = useAuth();

  const [docs, setDocs] = useState<WorkerPayrollDocument[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyPayrollDocuments();
      setDocs(data);
    } catch (err) {
      toastT.apiError(err, "Error al cargar tus nóminas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchDocs();
  }, [token, fetchDocs]);

  const handleOpen = async (doc: WorkerPayrollDocument) => {
    try {
      // filename is the multer-generated basename; openSecureFile routes it
      // through GET /api/files/:filename with authentication.
      await openSecureFile(doc.filename, doc.originalName);
    } catch (err) {
      toastT.apiError(err, "Error al abrir el archivo");
    }
  };

  // table style consistent with existing worker pages
  const thClass =
    "px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600";
  const trClass =
    "border-b border-slate-100 text-center hover:bg-slate-50/70 transition-colors";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Mis nóminas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Documentos de nómina asignados a tu perfil
          </p>
        </div>

        {/* Documents card */}
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">
              Documentos{" "}
              {!loading && (
                <span className="font-normal text-slate-500">
                  ({docs.length})
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={fetchDocs}
              disabled={loading}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 rounded-full px-3 py-1.5 disabled:opacity-50"
            >
              {loading ? "Cargando..." : "↻ Actualizar"}
            </button>
          </div>

          <div className="p-4">
            {loading && docs.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                Cargando documentos...
              </p>
            )}

            {!loading && docs.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                Aún no tienes documentos de nómina disponibles.
              </p>
            )}

            {docs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[45%]" />
                    <col className="w-[25%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                  </colgroup>

                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className={`${thClass} text-left`}>Archivo</th>
                      <th className={thClass}>Período</th>
                      <th className={thClass}>Fecha</th>
                      <th className={thClass}>Abrir</th>
                    </tr>
                  </thead>

                  <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                    {docs.map((doc) => (
                      <tr key={doc._id} className={trClass}>

                        {/* Original filename */}
                        <td className="px-3 py-2 align-middle text-left">
                          <span
                            className="block text-slate-800 font-medium truncate max-w-[260px]"
                            title={doc.originalName}
                          >
                            {doc.originalName}
                          </span>
                        </td>

                        {/* Period: month + year */}
                        <td className="px-3 py-2 align-middle whitespace-nowrap">
                          {periodLabel(doc.year, doc.month) !== "—" ? (
                            periodLabel(doc.year, doc.month)
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Upload date */}
                        <td className="px-3 py-2 align-middle whitespace-nowrap text-slate-500">
                          {fmtDate(doc.createdAt)}
                        </td>

                        {/* Open action */}
                        <td className="px-3 py-2 align-middle">
                          <button
                            type="button"
                            onClick={() => handleOpen(doc)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                            aria-label={`Abrir ${doc.originalName}`}
                          >
                            📄 Ver
                          </button>
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
    </div>
  );
}
