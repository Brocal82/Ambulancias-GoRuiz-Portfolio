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
import { displayFileNameFromUrl } from '../utils/fileName';


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
  const [openDocsId, setOpenDocsId] = useState<string | null>(null);

  // ➕ NUEVO: adjuntos en el formulario de creación
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [isCreatingUpload, setIsCreatingUpload] = useState(false);



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

      // 1) Crear la baja
      const created = await createSickLeave({
        startDate,
        endDate,
        note: note?.trim() || undefined,
      });

      // 2) Si hay archivos seleccionados en el formulario, adjuntarlos ahora
      if (createFiles.length > 0 && created?._id) {
        setIsCreatingUpload(true);
        for (const f of createFiles) {
          await attachSickDocumentFile(created._id, f);
        }
      }

      toastT.success(['pages.sick.create.ok']);

      // 3) Reset de formulario y lista
      setStartDate('');
      setEndDate('');
      setNote('');
      setCreateFiles([]);

      // 4) Refrescar listado
      await loadList();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || 'pages.sick.create.error';
      toastT.error([msg]);
    } finally {
      setIsCreatingUpload(false);
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
    if (status === 'pending') return <span className={`${base} bg-amber-100 text-amber-800`}>{t('pages.sick.status.pending', 'Pendiente')}</span>;
    if (status === 'accepted') return <span className={`${base} bg-emerald-100 text-emerald-800`}>{t('pages.sick.status.accepted', 'Aceptada')}</span>;
    return <span className={`${base} bg-rose-100 text-rose-800`}>{t('pages.sick.status.rejected', 'Rechazada')}</span>;
  };


  return (
    <div className="mx-auto max-w-4xl p-4">
      {/* Título */}
      <h1 className="text-xl font-semibold text-slate-900 mb-4">
        {t('pages.sick.title', 'Bajas por enfermedad')}
      </h1>

      {/* Formulario crear solicitud */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          {t('pages.sick.create.title', 'Solicitar baja')}
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Fila: rango de fechas compacto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700">
                {t('pages.sick.create.daterange', 'Rango de fechas')}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="sick-start"
                  type="date"
                  aria-label={t('pages.sick.create.start', 'Desde') || 'Desde'}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-slate-400">—</span>
                <input
                  id="sick-end"
                  type="date"
                  aria-label={t('pages.sick.create.end', 'Hasta') || 'Hasta'}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="sick-note" className="block text-xs font-medium text-slate-700">
                {t('pages.sick.create.note', 'Nota (opcional)')}
              </label>
              <input
                id="sick-note"
                type="text"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                placeholder={t('pages.sick.create.notePlaceholder', 'Motivo breve, p. ej. fiebre')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {/* Adjuntar documentos (opcional) */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              {t('pages.sick.create.docs.label', 'Adjuntar documentos (opcional)')}
            </label>

            {/* Botón minimalista de adjuntar */}
            <FileUpload
              id="create-sick-docs"
              label={t('pages.sick.create.docs.select', 'Adjuntar')}
              accept="application/pdf,image/*"
              multiple
              maxSizeMB={10}
              showSelectedList={false}  // ocultamos la lista interna; mostramos la nuestra debajo
              onFilesSelect={(files) => {
                const incoming = files || [];
                setCreateFiles((prev) => {
                  const merged = [...prev];
                  for (const f of incoming) {
                    const dup = merged.some(
                      (e) => e.name === f.name && e.size === f.size && e.lastModified === f.lastModified
                    );
                    if (!dup) merged.push(f);
                  }
                  return merged;
                });
              }}
              hintWhenEmpty={t('pages.sick.create.docs.hint', 'PDF o imágenes. Máx 10 MB por archivo')}
              className="min-w-[200px]"
              disabled={loading || isCreatingUpload}
            />

            {/* Lista compacta de adjuntos (debajo del botón) */}
            {createFiles.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {createFiles.map((f, idx) => (
                  <li
                    key={f.name + f.size + f.lastModified}
                    className="group inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs"
                    title={f.name}
                  >
                    <span aria-hidden="true" className="mr-1">📎</span>
                    <span className="truncate max-w-[220px]">{f.name}</span>
                    <button
                      type="button"
                      aria-label={t('common.remove', 'Quitar')}
                      className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                      onClick={() =>
                        setCreateFiles((prev) => {
                          const copy = [...prev];
                          copy.splice(idx, 1);
                          return copy;
                        })
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[11px] text-slate-500">
              {t('pages.sick.create.docs.note', 'Puedes enviar la solicitud sin documento y adjuntarlo más tarde.')}
            </p>
          </div>

          {/* Botón enviar: pequeño y abajo a la derecha */}
          <div className="flex items-center justify-end">
            <div className="space-y-1 text-right">
              {!canSubmit && (
                <p className="text-xs text-rose-600">
                  {t('pages.sick.create.invalidDatesHelp', 'Revisa que las fechas sean válidas')}
                </p>
              )}
              <button
                type="submit"
                disabled={!canSubmit || loading || isCreatingUpload}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              >
                {isCreatingUpload
                  ? t('pages.sick.create.uploading', 'Enviando…')
                  : t('pages.sick.create.submit', 'Enviar')}
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* Listado en tabla */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            {t('pages.sick.list.title', 'Mis solicitudes')}
          </h2>

          {isLoadingList && (
            <div className="text-sm text-slate-600">
              {t('common.loading', 'Cargando...')}
            </div>
          )}

          {!isLoadingList && items.length === 0 && (
            <div className="text-sm text-slate-600">
              {t('pages.sick.list.empty', 'Aún no has solicitado ninguna baja')}
            </div>
          )}

          {!isLoadingList && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[26%]" /> {/* Fechas */}
                  <col className="w-[10%]" /> {/* Días */}
                  <col className="w-[16%]" /> {/* Estado */}
                  <col className="w-[28%]" /> {/* Documentos */}
                  <col className="w-[20%]" /> {/* Adjuntar / Enviar */}
                </colgroup>

                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-600 border-b border-slate-200 text-center">
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t('pages.sick.admin.th.dates', 'Fechas')}
                    </th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t('pages.sick.admin.th.days', 'Días')}
                    </th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t('pages.sick.admin.th.status', 'Estado')}
                    </th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t('pages.sick.admin.th.doc', 'Documento')}
                    </th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t('pages.sick.worker.actions', 'Acciones')}
                    </th>
                  </tr>
                </thead>

                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                  {items.map((it) => {
                    const selected = pendingFiles[it._id] || [];
                    const isUploading = uploadingIds.has(it._id);

                    // Documentos existentes (legacy + array) + DEDUP
const rawDocUrls: string[] = [
  ...(it.documentUrl ? [it.documentUrl] : []),
  ...(Array.isArray(it.documents) ? it.documents : []),
];

// Normalizamos por "nombre visible" (o por pathname) para evitar duplicados
const seen = new Set<string>();
const docUrls = rawDocUrls.filter((u) => {
  // Opción A (por nombre visible):
  const key = displayFileNameFromUrl(u).toLowerCase();

  // Opción B (por ruta sin querystring), si prefieres:
  // const key = (u.split('?')[0] || u).toLowerCase();

  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const count = docUrls.length;
const isOpen = openDocsId === it._id;


                    // Cálculo de días (inclusivo)
                    const days = (() => {
                      const s = new Date(it.startDate);
                      const e = new Date(it.endDate);
                      s.setHours(0, 0, 0, 0);
                      e.setHours(0, 0, 0, 0);
                      const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
                      return isNaN(diff) ? '—' : Math.max(diff, 1);
                    })();

                    return (
                      <tr key={it._id} className="border-b border-slate-100 text-center hover:bg-slate-50/70">
                        {/* Fechas */}
                        <td className="px-3 py-2 align-top">
                          <div className="text-slate-800 whitespace-nowrap">
                            {fmtISO(it.startDate, i18n.language)} — {fmtISO(it.endDate, i18n.language)}
                          </div>
                          {it.note && (
                            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                              {it.note}
                            </div>
                          )}
                        </td>

                        {/* Días */}
                        <td className="px-3 py-2 align-top">{days}</td>

                        {/* Estado */}
                        <td className="px-3 py-2 align-top whitespace-nowrap">
                          {badge(it.status)}
                        </td>

                        {/* Documentos: contador azul (sin 📎) -> chips con nombre real, sin X */}
                        <td className="px-3 py-2 align-top">
                          {count === 0 ? (
                            <span className="text-slate-500">
                              {t('pages.sick.docs.none', 'Sin documento')}
                            </span>
                          ) : (
                            <div className="inline-block text-center">
                              <button
                                type="button"
                                onClick={() => setOpenDocsId(isOpen ? null : it._id)}
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline underline-offset-2"
                                aria-expanded={isOpen}
                                aria-controls={`docs-panel-${it._id}`}
                              >
                                <span>
                                  {t('pages.sick.docs.count', '{{n}} documentos', { n: count })}
                                </span>
                                <span
                                  className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                  aria-hidden="true"
                                >
                                  ▾
                                </span>
                              </button>

                              <div
                                id={`docs-panel-${it._id}`}
                                className={`overflow-hidden transition-all duration-200 ease-out mt-2 ${isOpen ? 'opacity-100 max-h-56' : 'opacity-0 max-h-0'
                                  }`}
                              >
                                <ul className="flex flex-wrap justify-center gap-2">
                                  {docUrls.map((url, idx) => {
                                    const label = displayFileNameFromUrl(url);
                                    return (
                                      <li
                                        key={url + idx}
                                        className="inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
                                        title={label}
                                      >
                                        <span aria-hidden="true" className="mr-1">📎</span>
                                        <a
                                          href={buildImageUrl(url)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="truncate max-w-[180px] text-slate-700 hover:text-slate-900"
                                        >
                                          {label}
                                        </a>
                                      </li>
                                    );
                                  })}
                                </ul>

                              </div>
                            </div>
                          )}
                        </td>

                        {/* Acciones: Adjuntar (selector) + Subir (flecha) + chips locales con X roja */}
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2">
                              <FileUpload
                                id={`sick-doc-${it._id}`}
                                label={t('pages.sick.docs.select', 'Adjuntar')}
                                accept="application/pdf,image/*"
                                multiple
                                maxSizeMB={10}
                                showSelectedList={false}
                                onFilesSelect={(files) =>
                                  setPendingFiles((prev) => {
                                    const existing = prev[it._id] || [];
                                    const incoming = files || [];
                                    const merged = [...existing];
                                    for (const f of incoming) {
                                      const isDup = existing.some(
                                        (e) =>
                                          e.name === f.name &&
                                          e.size === f.size &&
                                          e.lastModified === f.lastModified
                                      );
                                      if (!isDup) merged.push(f);
                                    }
                                    return { ...prev, [it._id]: merged };
                                  })
                                }
                                hintWhenEmpty={t('pages.sick.docs.noneSelected', 'Ningún archivo seleccionado')}
                                className="min-w-[140px]"
                                disabled={isUploading}
                              />

                              <button
                                className="inline-flex items-center rounded-md bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
                                onClick={() => onAttachDocFiles(it._id)}
                                disabled={selected.length === 0 || isUploading}
                                title={t('pages.sick.docs.attach', 'Subir documentos') as string}
                              >
                                {isUploading ? t('pages.sick.docs.uploading', 'Subiendo...') : '⬆️'}
                              </button>
                            </div>

                            {/* Chips de selección local (antes de subir) con X roja */}
                            {selected.length > 0 && (
                              <ul className="flex flex-wrap justify-center gap-2">
                                {selected.map((f, idx) => (
                                  <li
                                    key={f.name + f.size + f.lastModified}
                                    className="group inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
                                    title={f.name}
                                  >
                                    <span aria-hidden="true" className="mr-1">📎</span>
                                    <span className="truncate max-w-[150px]">{f.name}</span>
                                    <button
                                      type="button"
                                      aria-label={t('common.remove', 'Quitar')}
                                      className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                                      onClick={() =>
                                        setPendingFiles((prev) => {
                                          const copy = [...(prev[it._id] || [])];
                                          copy.splice(idx, 1);
                                          return { ...prev, [it._id]: copy };
                                        })
                                      }
                                    >
                                      ×
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
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
  );



}
