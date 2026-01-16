// frontend/src/pages/WorkerSickLeavesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";
import {
  createSickLeave,
  listMySickLeaves,
  attachSickDocumentFile, // ← asegúrate de tener esta función en api/sickLeaves.ts
  type SickLeave,
} from "../api/sickLeaves";
import FileUpload from "../components/common/FileUpload";
import { buildImageUrl } from "../utils/apiOrigins";
import { displayFileNameFromUrl } from "../utils/fileName";
import SickLeaveRequestForm from "../components/sick/SickLeaveRequestForm";
import StatusBadge from "../components/common/StatusBadge";

function fmtISO(d?: string, locale?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale || "es");
}

export default function WorkerSickLeavesPage() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  // form
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // list
  const [items, setItems] = useState<SickLeave[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  // gestión de archivos por solicitud (para adjuntar tras crear)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [openDocsId, setOpenDocsId] = useState<string | null>(null);

  // adjuntos en el formulario de creación
  const [showCreateForm, setShowCreateForm] = useState(false);
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
      toastT.error(["pages.sick.listLoadError"]);
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
      toastT.error(["pages.sick.create.invalidDates"]);
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

      toastT.success(["pages.sick.create.ok"]);

      // 3) Reset de formulario y lista
      setStartDate("");
      setEndDate("");
      setNote("");
      setCreateFiles([]);

      // 👇 4) Cerrar el formulario automáticamente tras envío exitoso
      setShowCreateForm(false);

      // 👇 4.1) Scroll suave hacia la parte superior del formulario
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 200);

      // 5) Refrescar listado
      await loadList();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || "pages.sick.create.error";
      toastT.error([msg]);
    } finally {
      setIsCreatingUpload(false);
      setLoading(false);
    }
  };

  // ✅ Nuevo: subir UN solo archivo (flecha junto al chip)
  const onAttachSingleFile = async (
    sickLeaveId: string,
    file: File,
    indexToRemove: number,
  ) => {
    try {
      setUploadingIds((prev) => new Set(prev).add(sickLeaveId));
      await attachSickDocumentFile(sickLeaveId, file);
      // quitarlo de la cola local
      setPendingFiles((prev) => {
        const list = [...(prev[sickLeaveId] || [])];
        list.splice(indexToRemove, 1);
        return { ...prev, [sickLeaveId]: list };
      });
      toastT.success(["pages.sick.attachDoc.ok"]);
      await loadList();
    } catch (err: any) {
      console.error(err);
      toastT.error([
        err?.response?.data?.message || "pages.sick.attachDoc.error",
      ]);
    } finally {
      setUploadingIds((prev) => {
        const next = new Set(prev);
        next.delete(sickLeaveId);
        return next;
      });
    }
  };


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Título centrado (igual Vacation) */}
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("pages.sick.title", "Bajas por enfermedad")}
          </h2>
        </div>

        {/* === Card principal (idéntica a Vacation) === */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 mb-6">
          {/* Toggle + mensaje (misma disposición que Vacation) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <button
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm
                ? t(
                  "pages.vacations.workerPage.toggleCloseForm",
                  "Cerrar formulario",
                )
                : t(
                  "pages.vacations.workerPage.toggleOpenForm",
                  "Abrir formulario",
                )}
            </button>

            {/* Si quieres mostrar un mensaje como en Vacation, úsalo aquí */}
            {/* {formMessage && <p className="text-sm text-emerald-700">{formMessage}</p>} */}
          </div>

          {/* Formulario idéntico a Vacation: tarjeta blanca interior + caja gris del calendario */}
          {showCreateForm && (
            // Caja GRIS directamente (sin tarjeta blanca intermedia)
            <div className="rounded-xl ring-1 ring-slate-200 p-4 bg-slate-50">
              {/* Ajuste de ancho del DateRange idéntico a Vacation */}
              <style>{`
      .vacation-range .rdrDateRangeWrapper,
      .vacation-range .rdrCalendarWrapper,
      .vacation-range .rdrMonths,
      .vacation-range .rdrMonth { width: 100%; }
    `}</style>

              <div className="mx-auto max-w-lg">
                {/* TARJETA BLANCA INTERIOR: h2 + calendario + nota + adjuntar + enviar */}
                <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5">
                  {/* H2 dentro de la tarjeta blanca interior */}
                  <h2 className="text-lg font-semibold text-slate-900 mb-3">
                    {t("pages.sick.create.title", "Solicitar baja")}
                  </h2>

                  {/* Calendario */}
                  <div className="vacation-range rounded-xl ring-1 ring-slate-200 overflow-hidden w-full">
                    <SickLeaveRequestForm
                      startDateStr={startDate}
                      endDateStr={endDate}
                      localeCode={i18n.language}
                      onChange={(s, e) => {
                        setStartDate(s);
                        setEndDate(e);
                      }}
                    />
                  </div>

                  {/* Nota + Adjuntar dentro de la misma tarjeta blanca */}
                  <div className="mt-3 space-y-3">
                    <div>
                      <label
                        htmlFor="sick-note"
                        className="block text-xs font-medium text-slate-700"
                      >
                        {t("pages.sick.create.note", "Nota (opcional)")}
                      </label>
                      <input
                        id="sick-note"
                        type="text"
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder={t(
                          "pages.sick.create.notePlaceholder",
                          "Motivo breve, p. ej. fiebre",
                        )}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        {t(
                          "pages.sick.create.docs.label",
                          "Adjuntar documentos (opcional)",
                        )}
                      </label>

                      <FileUpload
                        id="create-sick-docs"
                        label={t("pages.sick.create.docs.select", "Adjuntar")}
                        accept="application/pdf,image/*"
                        multiple
                        maxSizeMB={10}
                        showSelectedList={false}
                        onFilesSelect={(files) => {
                          const incoming = files || [];
                          setCreateFiles((prev) => {
                            const merged = [...prev];
                            for (const f of incoming) {
                              const dup = merged.some(
                                (e) =>
                                  e.name === f.name &&
                                  e.size === f.size &&
                                  e.lastModified === f.lastModified,
                              );
                              if (!dup) merged.push(f);
                            }
                            return merged;
                          });
                        }}
                        hintWhenEmpty={t(
                          "pages.sick.create.docs.hint",
                          "PDF o imágenes. Máx 10 MB por archivo",
                        )}
                        className="min-w-[200px]"
                        disabled={loading || isCreatingUpload}
                      />

                      {createFiles.length > 0 && (
                        <ul className="mt-2 flex flex-wrap justify-start gap-2">
                          {createFiles.map((f, idx) => (
                            <li
                              key={f.name + f.size + f.lastModified}
                              className="group inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs"
                              title={f.name}
                            >
                              <span aria-hidden="true" className="mr-1">
                                📎
                              </span>
                              <span className="truncate max-w-[220px]">
                                {f.name}
                              </span>
                              <button
                                type="button"
                                aria-label={t("common.remove", "Quitar")}
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

                      <p className="mt-1 text-[11px] text-slate-500">
                        {t(
                          "pages.sick.create.docs.note",
                          "Puedes enviar la solicitud sin documento y adjuntarlo más tarde.",
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Botón Enviar dentro de la tarjeta blanca interior */}
                  <button
                    type="submit"
                    onClick={onSubmit as any}
                    disabled={!canSubmit || loading || isCreatingUpload}
                    className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                  >
                    {isCreatingUpload
                      ? t("pages.sick.create.uploading", "Enviando…")
                      : t("pages.sick.create.submit", "Enviar")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* === Listado en tabla (sin cambios) === */}
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              {t("pages.sick.list.title", "Mis solicitudes")}
            </h2>

            {isLoadingList && (
              <div className="text-sm text-slate-600">
                {t("common.loading", "Cargando...")}
              </div>
            )}

            {!isLoadingList && items.length === 0 && (
              <div className="text-sm text-slate-600">
                {t(
                  "pages.sick.list.empty",
                  "Aún no has solicitado ninguna baja",
                )}
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
                    <col className="w-[20%]" /> {/* Acciones */}
                  </colgroup>

                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="text-slate-600 border-b border-slate-200 text-center">
                      <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                        {t("pages.sick.admin.th.dates", "Fechas")}
                      </th>
                      <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                        {t("pages.sick.admin.th.days", "Días")}
                      </th>
                      <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                        {t("pages.sick.admin.th.status", "Estado")}
                      </th>
                      <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                        {t("pages.sick.admin.th.doc", "Documentos")}
                      </th>
                      <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                        {t("pages.sick.worker.actions", "Acciones")}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                    {items.map((it) => {
                      const selected = pendingFiles[it._id] || [];
                      const isUploading = uploadingIds.has(it._id);

                      // Documentos existentes (legacy + array) + DEDUP por nombre visible
                      const rawDocUrls: string[] = [
                        ...(it.documentUrl ? [it.documentUrl] : []),
                        ...(Array.isArray(it.documents) ? it.documents : []),
                      ];
                      const seen = new Set<string>();
                      const docUrls = rawDocUrls.filter((u) => {
                        const key = (
                          displayFileNameFromUrl(u) || u
                        ).toLowerCase();
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
                        const diff =
                          Math.round((e.getTime() - s.getTime()) / 86400000) +
                          1;
                        return isNaN(diff) ? "—" : Math.max(diff, 1);
                      })();

                      return (
                        <tr
                          key={it._id}
                          className="border-b border-slate-100 text-center hover:bg-slate-50/70"
                        >
                          {/* Fechas */}
                          <td className="px-3 py-2 align-top">
                            <div className="text-slate-800 whitespace-nowrap">
                              {fmtISO(it.startDate, i18n.language)} —{" "}
                              {fmtISO(it.endDate, i18n.language)}
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
                            <StatusBadge
                              tone={
                                it.status === "pending"
                                  ? "amber"
                                  : it.status === "accepted"
                                    ? "emerald"
                                    : "rose"
                              }
                              label={t(`pages.sick.status.${it.status}`, it.status)}
                            />
                          </td>

                          {/* Documentos */}
                          <td className="px-3 py-2 align-top">
                            {count === 0 ? (
                              <span className="text-slate-500">
                                {t("pages.sick.docs.none", "Sin documento")}
                              </span>
                            ) : (
                              <div className="inline-block text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenDocsId(isOpen ? null : it._id)
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                  aria-expanded={isOpen}
                                  aria-controls={`docs-panel-month-${it._id}`}
                                >
                                  <span className="whitespace-nowrap">
                                    {t(
                                      "pages.sick.docs.count",
                                      "{{n}} documentos",
                                      { n: count },
                                    )}
                                  </span>
                                </button>

                                <div
                                  id={`docs-panel-${it._id}`}
                                  className={`overflow-hidden transition-all duration-200 ease-out mt-2 ${isOpen
                                      ? "opacity-100 max-h-56"
                                      : "opacity-0 max-h-0"
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
                                          <span
                                            aria-hidden="true"
                                            className="mr-1"
                                          >
                                            📎
                                          </span>
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

                          {/* Acciones: Adjuntar selector + chips locales */}
                          <td className="px-3 py-2 align-top">
                            <div className="flex flex-col items-center gap-2">
                              <FileUpload
                                id={`sick-doc-${it._id}`}
                                label={t("pages.sick.docs.select", "Adjuntar")}
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
                                          e.lastModified === f.lastModified,
                                      );
                                      if (!isDup) merged.push(f);
                                    }
                                    return { ...prev, [it._id]: merged };
                                  })
                                }
                                hintWhenEmpty={t(
                                  "pages.sick.docs.noneSelected",
                                  "Ningún archivo seleccionado",
                                )}
                                className="min-w-[140px]"
                                disabled={isUploading}
                              />

                              {selected.length > 0 && (
                                <ul className="flex flex-wrap justify-center gap-2">
                                  {selected.map((f, idx) => (
                                    <li
                                      key={f.name + f.size + f.lastModified}
                                      className="flex items-center gap-2"
                                    >
                                      <span
                                        className="inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
                                        title={f.name}
                                      >
                                        <span
                                          aria-hidden="true"
                                          className="mr-1"
                                        >
                                          📎
                                        </span>
                                        <span className="truncate max-w-[150px]">
                                          {f.name}
                                        </span>
                                        <button
                                          type="button"
                                          aria-label={t(
                                            "common.remove",
                                            "Quitar",
                                          )}
                                          className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                                          onClick={() =>
                                            setPendingFiles((prev) => {
                                              const copy = [
                                                ...(prev[it._id] || []),
                                              ];
                                              copy.splice(idx, 1);
                                              return {
                                                ...prev,
                                                [it._id]: copy,
                                              };
                                            })
                                          }
                                        >
                                          ×
                                        </button>
                                      </span>

                                      <button
                                        type="button"
                                        title={
                                          t(
                                            "pages.sick.docs.uploadOne",
                                            "Subir este documento",
                                          ) as string
                                        }
                                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                        disabled={isUploading}
                                        onClick={() =>
                                          onAttachSingleFile(it._id, f, idx)
                                        }
                                      >
                                        ⬆️
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
    </div>
  );
}
