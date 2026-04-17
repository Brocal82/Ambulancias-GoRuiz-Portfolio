import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import {
  acknowledgeMyDocumentDelivery,
  listMyDocumentDeliveries,
  markMyDocumentDeliveryRead,
} from "../domain/api";
import type { WorkerDocumentDelivery } from "../domain/types";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deliveryStatus(row: WorkerDocumentDelivery): "Pendiente" | "Leído" | "Confirmado" {
  if (row.acknowledgedAt) return "Confirmado";
  if (row.readAt) return "Leído";
  return "Pendiente";
}

export default function WorkerDocumentsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<WorkerDocumentDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [ackTarget, setAckTarget] = useState<WorkerDocumentDelivery | null>(null);
  const [ackPassword, setAckPassword] = useState("");
  const [ackSubmitting, setAckSubmitting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyDocumentDeliveries();
      setRows(data);
    } catch (err) {
      toastT.apiError(err, "Error al cargar tus documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchRows();
  }, [token, fetchRows]);

  const handleOpen = async (row: WorkerDocumentDelivery) => {
    setOpeningId(row.deliveryId);
    try {
      await openSecureFile(row.filename, row.originalName);
      try {
        await markMyDocumentDeliveryRead(row.deliveryId);
        toastT.success("Documento abierto y marcado como leído");
      } catch (markErr) {
        toastT.apiError(markErr, "El documento se abrió pero no se pudo registrar la lectura");
      }
      await fetchRows();
    } catch (err) {
      toastT.apiError(err, "Error al abrir el documento");
    } finally {
      setOpeningId(null);
    }
  };

  const openAckModal = (row: WorkerDocumentDelivery) => {
    setAckTarget(row);
    setAckPassword("");
  };

  const closeAckModal = () => {
    setAckTarget(null);
    setAckPassword("");
  };

  const submitAcknowledge = async () => {
    if (!ackTarget) return;
    const pwd = ackPassword.trim();
    if (!pwd) {
      toastT.warn("Introduce tu contraseña");
      return;
    }
    setAckSubmitting(true);
    try {
      await acknowledgeMyDocumentDelivery(ackTarget.deliveryId, pwd);
      toastT.success("Recepción confirmada");
      closeAckModal();
      await fetchRows();
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = ax.response?.status;
      if (status === 409 && ax.response?.data?.message) {
        toastT.warn(ax.response.data.message);
      } else if (status === 400 && ax.response?.data?.message) {
        toastT.warn(ax.response.data.message);
      } else if (status === 401) {
        toastT.error("Email o contraseña incorrectos.");
      } else {
        toastT.apiError(err, "No se pudo confirmar la recepción");
      }
    } finally {
      setAckSubmitting(false);
    }
  };

  const thClass =
    "px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600";
  const trClass =
    "border-b border-slate-100 text-center hover:bg-slate-50/70 transition-colors";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Documentos de empresa
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Abre cada documento y confirma su recepción cuando corresponda
          </p>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">
              Entregas{" "}
              {!loading && (
                <span className="font-normal text-slate-500">({rows.length})</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => void fetchRows()}
              disabled={loading}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 rounded-full px-3 py-1.5 disabled:opacity-50 min-h-[44px] min-w-[44px]"
            >
              {loading ? "Cargando..." : "↻ Actualizar"}
            </button>
          </div>

          <div className="p-4">
            {loading && rows.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                Cargando documentos...
              </p>
            )}

            {!loading && rows.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No tienes documentos de empresa pendientes de revisar.
              </p>
            )}

            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[32%]" />
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[24%]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className={`${thClass} text-left`}>Documento</th>
                      <th className={thClass}>Enviado</th>
                      <th className={thClass}>Tipo</th>
                      <th className={thClass}>Estado</th>
                      <th className={thClass}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                    {rows.map((row) => {
                      const status = deliveryStatus(row);
                      const showAckButton =
                        row.requiresAcknowledgment === true && !row.acknowledgedAt;
                      return (
                        <tr key={row.deliveryId} className={trClass}>
                          <td className="px-3 py-3 align-middle text-left">
                            <span
                              className="block text-slate-800 font-medium truncate max-w-[220px] sm:max-w-none"
                              title={row.originalName}
                            >
                              {row.originalName}
                            </span>
                            <span className="block text-xs text-slate-500 mt-0.5">
                              Subido: {fmtDate(row.createdAt)}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle whitespace-nowrap text-slate-600 text-xs">
                            {fmtDate(row.sentAt)}
                          </td>
                          <td className="px-3 py-3 align-middle text-xs text-slate-600 whitespace-nowrap">
                            {row.mimeType}
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                status === "Confirmado"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : status === "Leído"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <div className="flex flex-col sm:flex-row gap-2 justify-center items-stretch">
                              <button
                                type="button"
                                onClick={() => void handleOpen(row)}
                                disabled={openingId === row.deliveryId}
                                className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                              >
                                📄 {openingId === row.deliveryId ? "Abriendo…" : "Abrir"}
                              </button>
                              {showAckButton ? (
                                <button
                                  type="button"
                                  onClick={() => openAckModal(row)}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                >
                                  Confirmar recepción
                                </button>
                              ) : row.requiresAcknowledgment === true ? (
                                <span className="text-xs text-slate-400 py-2">—</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {ackTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !ackSubmitting) closeAckModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ack-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="ack-dialog-title"
              className="text-lg font-semibold text-slate-900 mb-1"
            >
              Confirmar recepción
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Introduce tu contraseña para confirmar que has recibido:{" "}
              <span className="font-medium text-slate-800">{ackTarget.originalName}</span>
            </p>
            <label
              htmlFor="ack-password-input"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Contraseña
            </label>
            <input
              id="ack-password-input"
              type="password"
              autoComplete="current-password"
              value={ackPassword}
              onChange={(e) => setAckPassword(e.target.value)}
              placeholder="••••••••"
              aria-label="Contraseña"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm mb-4 min-h-[44px]"
            />
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={closeAckModal}
                disabled={ackSubmitting}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitAcknowledge()}
                disabled={ackSubmitting}
                className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {ackSubmitting ? "Confirmando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
