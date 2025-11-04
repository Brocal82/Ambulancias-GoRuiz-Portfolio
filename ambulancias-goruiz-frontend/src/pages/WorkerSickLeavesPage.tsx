// frontend/src/pages/WorkerSickLeavesPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toastT } from '../utils/toast';
import {
  createSickLeave,
  listMySickLeaves,
  attachSickDocumentFile, // ← asegúrate de tener esta función en api/sickLeaves.ts
  type SickLeave
} from '../api/sickLeaves';
import FileUpload from '../components/common/FileUpload';
import { buildImageUrl } from '../utils/apiOrigins';

function fmtISO(d?: string, locale?: string) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale || 'es');
}

export default function WorkerSickLeavesPage() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  // form
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // list
  const [items, setItems] = useState<SickLeave[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  // gestión de archivos por solicitud (1 archivo por baja)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());

  const canSubmit = useMemo(() => {
    if (!startDate || !endDate) return false;
    const s = new Date(startDate);
    const e = new Date(endDate);
    return !Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s;
  }, [startDate, endDate]);

  const loadList = async () => {
    if (!token) return;
    try {
      setIsLoadingList(true);
      const data = await listMySickLeaves();
      setItems(data);
    } catch (err) {
      console.error(err);
      toastT.error(['pages.sick.listLoadError']);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!canSubmit) {
      toastT.error(['pages.sick.create.invalidDates']);
      return;
    }

    try {
      setLoading(true);
      await createSickLeave({
        startDate,
        endDate,
        note: note?.trim() || undefined,
      });
      toastT.success(['pages.sick.create.ok']);
      setStartDate('');
      setEndDate('');
      setNote('');
      loadList();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || 'pages.sick.create.error';
      toastT.error([msg]);
    } finally {
      setLoading(false);
    }
  };


// ✅ Subir TODOS los archivos seleccionados para una baja (uno a uno)
const onAttachDocFiles = async (sickLeaveId: string) => {
  const files = pendingFiles[sickLeaveId] || [];
  if (files.length === 0) {
    toastT.error(['pages.sick.docs.noneSelected' as any]);
    return;
  }
  try {
    setUploadingIds(prev => new Set(prev).add(sickLeaveId));

    for (const f of files) {
      await attachSickDocumentFile(sickLeaveId, f); // ya la tienes en api/sickLeaves.ts
    }

    toastT.success(['pages.sick.attachDoc.ok']);
    // limpiar selección local
    setPendingFiles(prev => ({ ...prev, [sickLeaveId]: [] }));
    await loadList();
  } catch (err: any) {
    console.error(err);
    toastT.error([err?.response?.data?.message || 'pages.sick.attachDoc.error']);
  } finally {
    setUploadingIds(prev => {
      const next = new Set(prev);
      next.delete(sickLeaveId);
      return next;
    });
  }
};



  const badge = (status: SickLeave['status']) => {
    const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
    if (status === 'pending') return <span className={`${base} bg-amber-100 text-amber-800`}>{t('pages.sick.status.pending','Pendiente')}</span>;
    if (status === 'accepted') return <span className={`${base} bg-emerald-100 text-emerald-800`}>{t('pages.sick.status.accepted','Aceptada')}</span>;
    return <span className={`${base} bg-rose-100 text-rose-800`}>{t('pages.sick.status.rejected','Rechazada')}</span>;
  };

  const verifBadge = (v?: string) => {
    if (!v) return null;
    const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ml-2';
    if (v === 'pending') return <span className={`${base} bg-blue-100 text-blue-800`}>{t('pages.sick.verification.pending','Doc. pendiente')}</span>;
    if (v === 'received') return <span className={`${base} bg-emerald-100 text-emerald-800`}>{t('pages.sick.verification.received','Doc. recibido')}</span>;
    if (v === 'overdue') return <span className={`${base} bg-rose-100 text-rose-800`}>{t('pages.sick.verification.overdue','Doc. vencido')}</span>;
    return <span className={`${base} bg-slate-100 text-slate-700`}>{t('pages.sick.verification.notRequired','Doc. no requerido')}</span>;
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-semibold text-slate-900 mb-4">{t('pages.sick.title','Bajas por enfermedad')}</h1>

      {/* Formulario */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">{t('pages.sick.create.title','Solicitar baja')}</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="sick-start" className="block text-xs font-medium text-slate-700">{t('pages.sick.create.start','Desde')}</label>
            <input
              id="sick-start"
              type="date"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="sick-end" className="block text-xs font-medium text-slate-700">{t('pages.sick.create.end','Hasta')}</label>
            <input
              id="sick-end"
              type="date"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="sick-note" className="block text-xs font-medium text-slate-700">{t('pages.sick.create.note','Nota (opcional)')}</label>
            <input
              id="sick-note"
              type="text"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              placeholder={t('pages.sick.create.notePlaceholder','Motivo breve, p. ej. fiebre')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
            >
              {t('pages.sick.create.submit','Enviar solicitud')}
            </button>
            {!canSubmit && (
              <p className="mt-1 text-xs text-rose-600">{t('pages.sick.create.invalidDatesHelp','Revisa que las fechas sean válidas')}</p>
            )}
          </div>
        </form>
      </div>

      {/* Listado */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">{t('pages.sick.list.title','Mis solicitudes')}</h2>

        {isLoadingList && (
          <div className="text-sm text-slate-600">{t('common.loading','Cargando...')}</div>
        )}

        {!isLoadingList && items.length === 0 && (
          <div className="text-sm text-slate-600">{t('pages.sick.list.empty','Aún no has solicitado ninguna baja')}</div>
        )}

        {!isLoadingList && items.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => {
  const selected = pendingFiles[it._id] || [];
  const isUploading = uploadingIds.has(it._id);

  return (
    <li key={it._id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="text-sm">
        <p className="font-medium text-slate-800">
          {fmtISO(it.startDate, i18n.language)} — {fmtISO(it.endDate, i18n.language)} {badge(it.status)} {verifBadge(it.verificationStatus)}
        </p>

        {it.requiresDocument && it.documentDueAt && (
          <p className="text-[11px] text-slate-500">
            {t('pages.sick.docs.due','Documento hasta')}: {fmtISO(it.documentDueAt, i18n.language)}
          </p>
        )}

        {it.note && <p className="text-xs text-slate-600 mt-0.5">{it.note}</p>}

        {/* 👇 Mostrar TODOS los adjuntos si hay */}
        {(it.documents?.length || it.documentUrl) && (
          <div className="mt-1 space-y-1">
            {/* último (legacy) */}
            {it.documentUrl && (
              <p className="text-xs">
                <a
                  className="text-blue-600 underline"
                  href={buildImageUrl(it.documentUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('pages.sick.docs.view','Ver documento')}
                </a>
              </p>
            )}

            {/* lista completa */}
            {it.documents?.length ? (
              <ul className="text-xs list-disc pl-4">
                {it.documents.map((url, idx) => (
                  <li key={url + idx}>
                    <a
                      className="text-blue-600 underline"
                      href={buildImageUrl(url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('pages.sick.docs.viewN', { n: idx + 1, defaultValue: 'Ver documento {{n}}' })}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        {/* 👇 Ahora permitimos SUBIR MÁS incluso si ya hay documentos */}
        <FileUpload
          id={`sick-doc-${it._id}`}
          label={t('pages.sick.docs.select', 'Seleccionar documentos')}
          accept="application/pdf,image/*"
          multiple
          maxSizeMB={10}
          onFilesSelect={(files) =>
            setPendingFiles((prev) => ({
              ...prev,
              [it._id]: files || [],
            }))
          }
          hintWhenEmpty={t('pages.sick.docs.noneSelected', 'Ningún archivo seleccionado')}
          className="min-w-[220px]"
          disabled={isUploading}
        />

        <button
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-50"
          onClick={() => onAttachDocFiles(it._id)}
          disabled={selected.length === 0 || isUploading}
        >
          {isUploading
            ? t('pages.sick.docs.uploading', 'Subiendo...')
            : t('pages.sick.docs.attach', 'Adjuntar documento')}
        </button>
      </div>
    </li>
  );
})}

          </ul>
        )}
      </div>
    </div>
  );
}
