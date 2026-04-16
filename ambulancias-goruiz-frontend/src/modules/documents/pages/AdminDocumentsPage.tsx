import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import axiosInstance from "../../../api/axios";

type AdminDocument = {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  createdAt: string;
};

const AdminDocumentsPage = () => {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

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
    if (!file) {
      toastT.warn("Selecciona un archivo antes de subir");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      await axiosInstance.post("/api/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toastT.success("Documento subido correctamente");
      setFile(null);
      await fetchDocuments();
    } catch (err) {
      toastT.apiError(err, "Error al subir el documento");
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

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Subir documento
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="block text-sm text-slate-700">
              <span className="mr-3 font-medium">Archivo</span>
              <input
                type="file"
                accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] ?? null;
                  setFile(nextFile);
                }}
                className="mt-1 block text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100"
              />
            </label>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !file}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Subiendo..." : "Subir documento"}
            </button>
            {file ? (
              <span className="text-xs text-slate-600 truncate max-w-xs">
                {file.name}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            Se permiten archivos PDF e imágenes (JPG, PNG, WEBP) de hasta 10 MB.
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
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void handleOpen(doc)}
                          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Abrir
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

