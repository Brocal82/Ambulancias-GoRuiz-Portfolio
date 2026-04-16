import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import axiosInstance from "../../../api/axios";
import PayrollUploadTriggerButton from "../../../components/common/actions/PayrollUploadTriggerButton";
import SendIconButton from "../../../components/common/actions/SendIconButton";

type AdminDocument = {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  totalRecipients: number;
  readCount: number;
};

const AdminDocumentsPage = () => {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const [batchInputKey, setBatchInputKey] = useState(0);
  const [folderMode, setFolderMode] = useState(false);

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

  const handleUpload = async () => {
    if (batchFiles.length === 0) {
      toastT.warn("Selecciona al menos un archivo antes de enviar");
      return;
    }

    const formData = new FormData();
    batchFiles.forEach((f) => {
      formData.append("files", f);
    });

    setUploading(true);
    try {
      await axiosInstance.post("/api/documents/upload/batch", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toastT.success("Documentos enviados correctamente");
      setBatchFiles([]);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Documentos / Información para trabajador
          </h1>
          <p className="text-sm text-slate-600">
            Sube documentos generales de la empresa y consulta el histórico de archivos
            disponibles para compartir con los trabajadores.
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800">
            Subir documentos
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => {
                  if (folderMode) {
                    setFolderMode(false);
                    setBatchFiles([]);
                    setBatchInputKey((k) => k + 1);
                  }
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${!folderMode
                  ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
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
                    setBatchInputKey((k) => k + 1);
                  }
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${folderMode
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
                htmlFor="documents-batch-upload"
                className="block text-sm font-medium text-slate-700"
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
                onClick={() => {
                  setBatchFiles([]);
                  setBatchInputKey((k) => k + 1);
                }}
                aria-label="Quitar archivos seleccionados"
                title="Quitar archivos"
                className="shrink-0 text-red-400 hover:text-red-600 text-sm leading-none cursor-pointer"
              >
                ✕
              </button>
            ) : null}
              <SendIconButton
                onClick={handleUpload}
                disabled={uploading || batchFiles.length === 0}
                title={uploading ? "Enviando documentos..." : "Enviar documentos"}
                className="shrink-0"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Puedes seleccionar un archivo, varios archivos o una carpeta completa.
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium text-slate-600">
                      Nombre
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                      Fecha
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                      Tipo
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap text-center">
                      Enviados
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-slate-600 whitespace-nowrap text-center">
                      Leídos
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-slate-600 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 max-w-xs">
                        <span
                          className="text-sm text-slate-800 break-words"
                          title={doc.originalName}
                        >
                          {doc.originalName}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">
                        {doc.createdAt
                          ? format(new Date(doc.createdAt), "dd/MM/yyyy HH:mm", {
                              locale: es,
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                        {doc.mimeType}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700 text-center whitespace-nowrap">
                        {doc.totalRecipients}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700 text-center whitespace-nowrap">
                        {doc.readCount}
                      </td>
                      <td className="px-4 py-2 text-right space-x-2">
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
};

export default AdminDocumentsPage;

