import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import axiosInstance from "../../../api/axios";
import PayrollUploadTriggerButton from "../../../components/common/actions/PayrollUploadTriggerButton";
import SendIconButton from "../../../components/common/actions/SendIconButton";
import BackButton from "../../../components/ui/BackButton";

type AdminDocument = {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  totalRecipients: number;
  readCount: number;
  acknowledgedCount: number;
  pendingAcknowledgmentCount: number;
  /** Present when API returns it; not shown in UI yet. */
  readButNotAcknowledgedCount?: number;
  requiresAcknowledgment: boolean;
  /** Present for batch uploads; absent on legacy rows. */
  uploadBatchId?: string | null;
};

type DocumentDisplayRow =
  | { kind: "single"; doc: AdminDocument }
  | { kind: "group"; uploadBatchId: string; docs: AdminDocument[] };

/** Groups multi-file batches by stable `uploadBatchId`; singles and legacy rows stay individual. */
function buildDocumentDisplayRows(docs: AdminDocument[]): DocumentDisplayRow[] {
  const byBatch = new Map<string, AdminDocument[]>();
  for (const d of docs) {
    const bid = d.uploadBatchId;
    if (bid) {
      const arr = byBatch.get(bid) ?? [];
      arr.push(d);
      byBatch.set(bid, arr);
    }
  }

  const inMultiFileBatch = new Set<string>();
  for (const [, arr] of byBatch) {
    if (arr.length > 1) {
      for (const d of arr) {
        inMultiFileBatch.add(d.id);
      }
    }
  }

  const rows: DocumentDisplayRow[] = [];

  for (const [uploadBatchId, arr] of byBatch) {
    if (arr.length > 1) {
      const sorted = [...arr].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      rows.push({ kind: "group", uploadBatchId, docs: sorted });
    }
  }

  for (const d of docs) {
    if (inMultiFileBatch.has(d.id)) continue;
    rows.push({ kind: "single", doc: d });
  }

  rows.sort((a, b) => {
    const ta =
      a.kind === "group"
        ? new Date(a.docs[0].createdAt).getTime()
        : new Date(a.doc.createdAt).getTime();
    const tb =
      b.kind === "group"
        ? new Date(b.docs[0].createdAt).getTime()
        : new Date(b.doc.createdAt).getTime();
    return tb - ta;
  });

  return rows;
}

function batchSelectionSummary(
  files: File[],
  folderMode: boolean,
): { text: string; title: string } {
  const n = files.length;
  if (n === 0) {
    return {
      text: "Sin archivos seleccionados",
      title: "Sin archivos seleccionados",
    };
  }
  if (folderMode) {
    const text = `📁 ${n} archivo${n !== 1 ? "s" : ""} seleccionado${n !== 1 ? "s" : ""}`;
    return { text, title: text };
  }
  if (n > 1) {
    const text = `📎 ${n} archivos seleccionados`;
    return { text, title: text };
  }
  const name = files[0]!.name;
  return {
    text: "1 archivo seleccionado",
    title: name,
  };
}

const AdminDocumentsPage = () => {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const [batchInputKey, setBatchInputKey] = useState(0);
  const [folderMode, setFolderMode] = useState(false);
  const [requiresAcknowledgmentUpload, setRequiresAcknowledgmentUpload] =
    useState(false);
  const [expandedBatchIds, setExpandedBatchIds] = useState<Record<string, boolean>>(
    {},
  );

  const displayRows = useMemo(
    () => buildDocumentDisplayRows(documents),
    [documents],
  );

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get<AdminDocument[]>("/api/documents");
      setDocuments(response.data);
    } catch (err) {
      toastT.apiError(err, "Error al cargar los documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDocuments();
  }, []);

  useEffect(() => {
    if (batchFiles.length !== 1) {
      setRequiresAcknowledgmentUpload(false);
    }
  }, [batchFiles.length]);

  const handleUpload = async () => {
    if (batchFiles.length === 0) {
      toastT.warn("Selecciona al menos un archivo antes de enviar");
      return;
    }

    const formData = new FormData();
    batchFiles.forEach((f) => {
      formData.append("files", f);
    });
    if (batchFiles.length === 1 && requiresAcknowledgmentUpload) {
      formData.append("requiresAcknowledgment", "true");
    }

    setUploading(true);
    try {
      await axiosInstance.post("/api/documents/upload/batch", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toastT.success("Documentos enviados correctamente");
      setBatchFiles([]);
      setRequiresAcknowledgmentUpload(false);
      setBatchInputKey((k) => k + 1);
      await fetchDocuments();
    } catch (err) {
      toastT.apiError(err, "Error al subir el lote de documentos");
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (doc: AdminDocument) => {
    try {
      await openSecureFile(doc.filename, doc.originalName);
    } catch (err) {
      toastT.apiError(err, "Error al abrir el documento");
    }
  };

  const handleDelete = async (doc: AdminDocument) => {
    if (
      !window.confirm(
        "¿Eliminar este documento? Los accesos futuros quedarán bloqueados, pero el archivo se conservará en el sistema.",
      )
    ) {
      return;
    }
    try {
      await axiosInstance.delete(`/api/documents/${doc.id}`);
      toastT.success("Documento eliminado correctamente");
      await fetchDocuments();
    } catch (err) {
      toastT.apiError(err, "Error al eliminar el documento");
    }
  };

  const handleDeleteBatch = async (uploadBatchId: string, count: number) => {
    if (
      !window.confirm(
        `¿Eliminar este lote de ${count} documento${count !== 1 ? "s" : ""}? Los accesos futuros quedarán bloqueados, pero los archivos se conservarán en el sistema.`,
      )
    ) {
      return;
    }

    try {
      const response = await axiosInstance.delete<{
        message: string;
        deletedCount?: number;
      }>(`/api/documents/batch/${uploadBatchId}`);
      toastT.success(
        response.data.deletedCount
          ? `Lote eliminado correctamente (${response.data.deletedCount} documento${response.data.deletedCount !== 1 ? "s" : ""})`
          : response.data.message || "Lote eliminado correctamente",
      );
      setExpandedBatchIds((prev) => {
        const next = { ...prev };
        delete next[uploadBatchId];
        return next;
      });
      await fetchDocuments();
    } catch (err) {
      toastT.apiError(err, "Error al eliminar el lote de documentos");
    }
  };

  const batchSelection = batchSelectionSummary(batchFiles, folderMode);

  const toggleBatchExpanded = (uploadBatchId: string) => {
    setExpandedBatchIds((prev) => ({
      ...prev,
      [uploadBatchId]: !prev[uploadBatchId],
    }));
  };

  const formatUploadedAt = (createdAt: string) =>
    createdAt
      ? format(new Date(createdAt), "dd/MM/yyyy HH:mm", { locale: es })
      : "—";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <BackButton to="/admin/payroll" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Documentos / Información para trabajador
          </h1>
          <p className="text-sm text-slate-600">
            Sube documentos generales de la empresa y consulta el histórico de archivos
            disponibles para compartir con los trabajadores.
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">
            Subir documentos
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* SECTION 1 — Upload type */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  1. Tipo de subida
                </div>
                <div className="relative inline-grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0.5 top-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-md bg-white shadow-sm ring-1 ring-orange-200 transition-transform duration-200 ease-out ${
                      folderMode ? "translate-x-full" : "translate-x-0"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (folderMode) {
                        setFolderMode(false);
                        setBatchFiles([]);
                        setRequiresAcknowledgmentUpload(false);
                        setBatchInputKey((k) => k + 1);
                      }
                    }}
                    className={`relative z-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200/80 focus-visible:ring-offset-0 ${
                      !folderMode
                        ? "text-slate-800"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Archivos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!folderMode) {
                        setFolderMode(true);
                        setBatchFiles([]);
                        setRequiresAcknowledgmentUpload(false);
                        setBatchInputKey((k) => k + 1);
                      }
                    }}
                    className={`relative z-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200/80 focus-visible:ring-offset-0 ${
                      folderMode
                        ? "text-slate-800"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Carpeta
                  </button>
                </div>
              </div>

              {/* SECTION 2 — File selection */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  2. Seleccionar archivos
                </div>
                <label
                  htmlFor="documents-batch-upload"
                  className="sr-only"
                >
                  {folderMode ? "Carpeta de documentos" : "Archivos"}
                </label>
                <input
                  key={batchInputKey}
                  ref={batchInputRef}
                  id="documents-batch-upload"
                  type="file"
                  multiple
                  // @ts-expect-error: webkitdirectory is not in the standard typings
                  webkitdirectory={folderMode ? "" : undefined}
                  accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length === 0) return;
                    setBatchFiles((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
                <PayrollUploadTriggerButton
                  mode={folderMode ? "folder" : "files"}
                  onClick={() => {
                    batchInputRef.current?.click();
                  }}
                  label={folderMode ? "Subir carpeta" : "Subir varias"}
                />
              </div>

              {/* SECTION 3 — Acknowledgment option */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  3. Confirmación de lectura
                </div>
                <label
                  htmlFor="requires-ack-upload"
                  className={`inline-flex shrink-0 select-none items-center gap-2 ${
                    batchFiles.length === 1
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-40"
                  }`}
                >
                  <span
                    className="box-border flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 leading-none shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-500 ease-in-out hover:-translate-y-0.5 hover:border-orange-200 hover:bg-slate-100 hover:shadow-md"
                    aria-hidden="true"
                  >
                    <span className="flex h-full w-full items-center justify-center text-3xl leading-none">
                      ✍️
                    </span>
                  </span>
                  <input
                    id="requires-ack-upload"
                    type="checkbox"
                    checked={requiresAcknowledgmentUpload}
                    onChange={(e) =>
                      setRequiresAcknowledgmentUpload(e.target.checked)
                    }
                    disabled={batchFiles.length !== 1}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-green-600 accent-green-600 focus:ring-green-500"
                    aria-label="Requiere confirmación por el trabajador"
                  />
                </label>
              </div>

              {/* SECTION 4 — Selected files preview */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  4. Archivos seleccionados
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`min-w-0 truncate text-xs leading-tight ${batchFiles.length > 0 ? "text-blue-600 font-medium" : "text-slate-500"}`}
                    title={batchSelection.title}
                  >
                    {batchSelection.text}
                  </div>
                  {batchFiles.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBatchFiles([]);
                        setRequiresAcknowledgmentUpload(false);
                        setBatchInputKey((k) => k + 1);
                      }}
                      aria-label="Quitar archivos seleccionados"
                      title="Quitar archivos"
                      className="shrink-0 text-red-400 hover:text-red-600 text-sm leading-none cursor-pointer"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* SECTION 5 — Send action */}
            <div className="flex justify-end">
              <SendIconButton
                onClick={handleUpload}
                disabled={uploading || batchFiles.length === 0}
                title={uploading ? "Enviando documentos..." : "Enviar documentos"}
                className="shrink-0"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="px-1 py-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Documentos subidos
            </h2>
            {loading && (
              <span className="text-xs text-slate-500">Cargando…</span>
            )}
          </div>
          {documents.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">
              No hay documentos subidos todavía.
            </div>
          ) : (
            <div className="w-full">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="w-[20%] px-4 py-2 text-xs font-medium text-slate-600">
                      Nombre
                    </th>
                    <th className="w-[16%] px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                      Fecha
                    </th>
                    <th className="w-[14%] px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                      Tipo
                    </th>
                    <th className="w-[8%] px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap text-center">
                      Enviados
                    </th>
                    <th className="w-[8%] px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap text-center">
                      Leídos
                    </th>
                    <th className="w-[8%] px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap text-center">
                      Confirmados
                    </th>
                    <th className="w-[12%] px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap text-center">
                      Pendientes
                    </th>
                    <th className="w-[11%] px-4 py-2 text-xs font-medium text-slate-600 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayRows.map((row) =>
                    row.kind === "single" ? (
                      <tr key={row.doc.id} className="hover:bg-slate-50">
                        <td className="w-0 max-w-xs px-4 py-1.5">
                          <span
                            className="block truncate whitespace-nowrap text-sm text-slate-800"
                            title={row.doc.originalName}
                          >
                            {row.doc.originalName}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-sm text-slate-700 whitespace-nowrap">
                          {formatUploadedAt(row.doc.createdAt)}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-slate-600 whitespace-nowrap">
                          {row.doc.mimeType}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                          {row.doc.totalRecipients}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                          {row.doc.readCount}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                          {row.doc.acknowledgedCount}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                          {row.doc.pendingAcknowledgmentCount}
                        </td>
                        <td className="px-4 py-1.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleOpen(row.doc)}
                              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Abrir
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row.doc)}
                              className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <Fragment key={row.uploadBatchId}>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-1.5 max-w-xs">
                            <button
                              type="button"
                              onClick={() => toggleBatchExpanded(row.uploadBatchId)}
                              aria-expanded={!!expandedBatchIds[row.uploadBatchId]}
                              className="inline-flex max-w-full items-center gap-2 text-left text-sm font-medium text-slate-800 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 rounded"
                            >
                              <span className="shrink-0 text-slate-500" aria-hidden>
                                {expandedBatchIds[row.uploadBatchId] ? "▼" : "▶"}
                              </span>
                              <span className="break-words">
                                📁 Lote de documentos ({row.docs.length} archivos)
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-1.5 text-sm text-slate-700 whitespace-nowrap">
                            {formatUploadedAt(row.docs[0].createdAt)}
                          </td>
                          <td className="px-4 py-1.5 text-xs text-slate-500 whitespace-nowrap">
                            —
                          </td>
                          <td className="px-4 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                            {row.docs[0].totalRecipients}
                          </td>
                          <td className="px-4 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                            {row.docs[0].readCount}
                          </td>
                          <td className="px-4 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                            {row.docs[0].acknowledgedCount}
                          </td>
                          <td className="px-4 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                            {row.docs[0].pendingAcknowledgmentCount}
                          </td>
                          <td className="px-4 py-1.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteBatch(
                                  row.uploadBatchId,
                                  row.docs.length,
                                )
                              }
                              className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              Eliminar lote
                            </button>
                          </td>
                        </tr>
                        {expandedBatchIds[row.uploadBatchId] ? (
                          <tr className="bg-slate-50/80">
                            <td colSpan={8} className="px-4 py-2 pl-10">
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full text-left text-sm">
                                  <tbody className="divide-y divide-slate-100">
                                    {row.docs.map((doc) => (
                                      <tr key={doc.id} className="hover:bg-slate-50">
                                        <td className="w-0 max-w-xs px-3 py-1.5">
                                          <span
                                            className="block truncate whitespace-nowrap text-sm text-slate-800"
                                            title={doc.originalName}
                                          >
                                            {doc.originalName}
                                          </span>
                                        </td>
                                        <td className="px-3 py-1.5 text-sm text-slate-700 whitespace-nowrap">
                                          {formatUploadedAt(doc.createdAt)}
                                        </td>
                                        <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">
                                          {doc.mimeType}
                                        </td>
                                        <td className="px-3 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                                          {doc.totalRecipients}
                                        </td>
                                        <td className="px-3 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                                          {doc.readCount}
                                        </td>
                                        <td className="px-3 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                                          {doc.acknowledgedCount}
                                        </td>
                                        <td className="px-3 py-1.5 text-xs text-slate-700 text-center whitespace-nowrap">
                                          {doc.pendingAcknowledgmentCount}
                                        </td>
                                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                          <div className="inline-flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void handleOpen(doc)}
                                              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                            >
                                              Abrir
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void handleDelete(doc)}
                                              className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                                            >
                                              Eliminar
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDocumentsPage;

