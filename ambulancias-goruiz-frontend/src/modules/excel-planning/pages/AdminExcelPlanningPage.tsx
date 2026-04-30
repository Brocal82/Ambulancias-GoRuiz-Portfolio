import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getApiErrorMessage } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import {
  getExcelPlanningTemplate,
  putExcelPlanningTemplate,
  postExcelPlanningImport,
  publishExcelPlanningImport,
  listExcelPlanningWeeks,
  type ExcelPlanningMapping,
  type ExcelPlanRow,
} from "../domain/api";
import {
  DEFAULT_WORKER_CARD_LAYOUT,
  EMPTY_WORKER_CARD_LINE_NAME_HINTS,
  normalizeWorkerCardLayout,
  normalizeWorkerCardLineNameHints,
  type WorkerCardLayout,
  type WorkerCardLineNameHints,
} from "../domain/workerCardLayout";
import { withCommonIconButtonInteraction } from "../../../components/common/actions/iconButtonStyles";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";
import WorkerCardTemplateEditor from "../components/WorkerCardTemplateEditor";
import { stringifyExcelMappingForEditor } from "../domain/formatMappingEditorText";
import "./AdminExcelPlanningPage.css";

/** Alineado con el backend: `nameMatching` por defecto es solo nº (recomendado en producción). */
const DEFAULT_MAPPING: ExcelPlanningMapping = {
  sheetIndex: 0,
  requireWeekFromSheet: false,
  dataStartRow: 2,
  dienstNumberColumn: 0,
  rowLabelColumn: 1,
  dayColumns: [2, 3, 4, 5, 6, 7, 8],
  lineDelimiter: "\n",
  cellLineOrder: [
    "time",
    "vehicle",
    "employeeNumber",
    "name",
    "partnerName",
    "partnerEmployeeNumber",
  ],
  nameMatching: "employee_number_only",
  normalizeEmployeeNumber: "trim_strip_leading_zeros",
};

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → DD-MM-YYYY (pantalla) */
function formatYmdToDmy(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** DD-MM-YYYY → YYYY-MM-DD (API); devuelve null si el texto no es una fecha válida. */
function parseDmyToYmd(dmy: string): string | null {
  const m = dmy
    .trim()
    .match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const dNum = Number(m[1]);
  const moNum = Number(m[2]);
  const yNum = Number(m[3]);
  if (yNum < 1970 || yNum > 2100) return null;
  if (moNum < 1 || moNum > 12) return null;
  if (dNum < 1 || dNum > 31) return null;
  const d = new Date(Date.UTC(yNum, moNum - 1, dNum, 0, 0, 0, 0));
  if (Number.isNaN(d.getTime())) return null;
  if (
    d.getUTCFullYear() !== yNum ||
    d.getUTCMonth() !== moNum - 1 ||
    d.getUTCDate() !== dNum
  ) {
    return null;
  }
  return `${yNum}-${String(moNum).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
}

function parseYmdUtc(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

/** Devuelve el lunes ISO (UTC) de la semana de la fecha indicada. */
function isoWeekMondayUtc(ymd: string): string | null {
  const dt = parseYmdUtc(ymd);
  if (!dt) return null;
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return formatYmd(dt);
}

function weekRangeLabelFromMondayYmd(mondayYmd: string): string {
  const monday = parseYmdUtc(mondayYmd);
  if (!monday) return mondayYmd;
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return `${formatYmdToDmy(formatYmd(monday))} - ${formatYmdToDmy(formatYmd(sunday))}`;
}

function labelForPublishedWeekExcel(w: {
  weekStart: string;
  sourceStoredFilename?: string;
  sourceFileUrl?: string;
}): string {
  if (w.sourceStoredFilename?.trim()) return w.sourceStoredFilename.trim();
  if (w.sourceFileUrl) {
    const last = w.sourceFileUrl.split("/").pop();
    if (last) return decodeURIComponent(last);
  }
  return w.weekStart?.slice(0, 10) ?? "";
}

function mondayUtcThisWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7;
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - diff);
  return formatYmd(d);
}

export default function AdminExcelPlanningPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [mappingText, setMappingText] = useState(() =>
    stringifyExcelMappingForEditor(DEFAULT_MAPPING),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastImportId, setLastImportId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    parseErrors: string[];
    rows: ExcelPlanRow[];
    stats?: {
      totalCells: number;
      matchedByNumber: number;
      matchedByName: number;
      unmatched: number;
      numberKeyCollisions?: number;
      collidingKeysSample?: string[];
    };
    weekStartDetected?: string;
    fileUrl?: string;
  } | null>(null);
  const [weekStartPublish, setWeekStartPublish] = useState(() =>
    formatYmdToDmy(mondayUtcThisWeek()),
  );
  const [weeks, setWeeks] = useState<
    Array<{
      weekStart: string;
      publishedAt?: string;
      sourceFileUrl?: string;
      sourceStoredFilename?: string;
    }>
  >([]);
  const [workerCardLayout, setWorkerCardLayout] = useState<WorkerCardLayout>(
    () => ({ ...DEFAULT_WORKER_CARD_LAYOUT }),
  );
  const [workerCardLineNameHints, setWorkerCardLineNameHints] =
    useState<WorkerCardLineNameHints>(() => ({
      ...EMPTY_WORKER_CARD_LINE_NAME_HINTS,
    }));

  const plantillaColRef = useRef<HTMLDivElement>(null);
  const mapeoColRef = useRef<HTMLDivElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const publishedFilesPanelRef = useRef<HTMLDivElement>(null);
  const [publishedFilesOpen, setPublishedFilesOpen] = useState(false);
  const [importPreviewModalOpen, setImportPreviewModalOpen] = useState(false);
  const [mapeoColHeightPx, setMapeoColHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (loading) return;
    const el = plantillaColRef.current;
    if (!el) return;
    const update = () => {
      setMapeoColHeightPx(Math.round(el.getBoundingClientRect().height));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [loading]);

  useLayoutEffect(() => {
    const el = mapeoColRef.current;
    if (!el) return;
    if (mapeoColHeightPx != null) {
      el.style.setProperty(
        "--excel-planning-mapeo-h",
        `${mapeoColHeightPx}px`,
      );
    } else {
      el.style.removeProperty("--excel-planning-mapeo-h");
    }
  }, [mapeoColHeightPx]);

  useEffect(() => {
    if (!publishedFilesOpen) return;
    const close = (e: MouseEvent) => {
      const n = e.target;
      if (
        n instanceof Node &&
        publishedFilesPanelRef.current &&
        !publishedFilesPanelRef.current.contains(n)
      ) {
        setPublishedFilesOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [publishedFilesOpen]);

  useEffect(() => {
    if (!importPreviewModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setImportPreviewModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importPreviewModalOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tpl = await getExcelPlanningTemplate();
      if (tpl?.mapping) {
        setName(tpl.name ?? "");
        setMappingText(stringifyExcelMappingForEditor(tpl.mapping));
        setWorkerCardLayout(
          normalizeWorkerCardLayout(
            (tpl.mapping as ExcelPlanningMapping).workerCardLayout,
          ),
        );
        setWorkerCardLineNameHints(
          normalizeWorkerCardLineNameHints(
            (tpl.mapping as ExcelPlanningMapping).workerCardLineNameHints,
          ),
        );
      }
      const w = await listExcelPlanningWeeks();
      setWeeks(w);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("excelPlanning.loadError")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const syncLayoutFromMappingJson = useCallback(() => {
    try {
      const parsed = JSON.parse(mappingText) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      const m = parsed as Record<string, unknown>;
      if ("workerCardLayout" in m) {
        setWorkerCardLayout(normalizeWorkerCardLayout(m.workerCardLayout));
      }
      if ("workerCardLineNameHints" in m) {
        setWorkerCardLineNameHints(
          normalizeWorkerCardLineNameHints(m.workerCardLineNameHints),
        );
      }
    } catch {
      // JSON inválido: no tocar el editor de plantilla
    }
  }, [mappingText]);

  const saveTemplate = async () => {
    let mapping: ExcelPlanningMapping;
    try {
      mapping = JSON.parse(mappingText) as ExcelPlanningMapping;
    } catch {
      toast.error(t("excelPlanning.invalidJson"));
      return;
    }
    mapping = {
      ...mapping,
      workerCardLayout,
      workerCardLineNameHints,
    };
    setSaving(true);
    try {
      await putExcelPlanningTemplate({
        name: name.trim() || undefined,
        mapping,
      });
      toast.success(t("excelPlanning.templateSaved"));
      setMappingText(stringifyExcelMappingForEditor(mapping));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("excelPlanning.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await postExcelPlanningImport(file);
      setLastImportId(data._id);
      setPreview({
        parseErrors: data.parseErrors ?? [],
        rows: data.previewRows ?? [],
        stats: data.stats,
        weekStartDetected: data.weekStartDetected,
        fileUrl: data.fileUrl,
      });
      setImportPreviewModalOpen(true);
      if (data.weekStartDetected) {
        setWeekStartPublish(
          formatYmdToDmy(data.weekStartDetected.slice(0, 10)),
        );
      }
      toast.success(t("excelPlanning.importParsed"));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("excelPlanning.importError")));
    }
  };

  const publish = async () => {
    if (!lastImportId) {
      toast.error(t("excelPlanning.noImport"));
      return;
    }
    const rawWeek = weekStartPublish.trim();
    let weekStartForApi: string | undefined;
    if (rawWeek) {
      const ymd = parseDmyToYmd(rawWeek);
      if (!ymd) {
        toast.error(t("excelPlanning.weekStartInvalidDmy"));
        return;
      }
      weekStartForApi = isoWeekMondayUtc(ymd) ?? ymd;
      if (weekStartForApi !== ymd) {
        toast.info(
          `Semana ajustada automáticamente al lunes ${formatYmdToDmy(weekStartForApi)}.`,
        );
      }
    } else {
      weekStartForApi = undefined;
    }
    try {
      await publishExcelPlanningImport(lastImportId, {
        weekStart: weekStartForApi,
      });
      toast.success(t("excelPlanning.published"));
      setLastImportId(null);
      setPreview(null);
      setImportPreviewModalOpen(false);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("excelPlanning.publishError")));
    }
  };

  const canPublish =
    Boolean(lastImportId) &&
    Boolean(preview?.rows?.length) &&
    (preview?.parseErrors?.length ?? 0) === 0 &&
    (preview?.stats?.unmatched ?? 0) === 0 &&
    (preview?.stats?.numberKeyCollisions ?? 0) === 0;

  const weekStartInputYmd = parseDmyToYmd(weekStartPublish.trim());
  const normalizedWeekStartYmd = weekStartInputYmd
    ? isoWeekMondayUtc(weekStartInputYmd)
    : null;
  const inputAlreadyMonday = weekStartInputYmd === normalizedWeekStartYmd;

  const pairCells = useMemo(() => {
    if (!preview?.rows?.length) return null;
    const rows = preview.rows;
    return rows.filter(
      (r) =>
        Boolean(r.partnerEmployeeNumber?.trim()) ||
        Boolean(r.displayPartnerNameFromExcel?.trim()),
    ).length;
  }, [preview?.rows]);

  const importPreviewAllGreen = useMemo(() => {
    if (!preview?.stats || !preview?.rows?.length) return false;
    if ((preview.parseErrors?.length ?? 0) > 0) return false;
    const s = preview.stats;
    if ((s.unmatched ?? 0) > 0) return false;
    if ((s.numberKeyCollisions ?? 0) > 0) return false;
    if (pairCells == null) return false;
    return pairCells === preview.rows.length;
  }, [preview?.parseErrors, preview?.stats, preview?.rows, pairCells]);

  const saveRecommendedTemplate = useCallback(async () => {
    setSaving(true);
    try {
      const layout = normalizeWorkerCardLayout({ ...DEFAULT_WORKER_CARD_LAYOUT });
      const hints = normalizeWorkerCardLineNameHints({
        ...EMPTY_WORKER_CARD_LINE_NAME_HINTS,
      });
      const mapping: ExcelPlanningMapping = {
        ...DEFAULT_MAPPING,
        workerCardLayout: layout,
        workerCardLineNameHints: hints,
      };
      await putExcelPlanningTemplate({
        name: name.trim() || undefined,
        mapping,
      });
      setMappingText(stringifyExcelMappingForEditor(mapping));
      setWorkerCardLayout(layout);
      setWorkerCardLineNameHints(hints);
      toast.success(t("excelPlanning.quickStartSaved"));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("excelPlanning.saveError")));
    } finally {
      setSaving(false);
    }
  }, [name, t]);

  if (loading) {
    return (
      <p className="text-center text-slate-600">{t("excelPlanning.loading")}</p>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{t("excelPlanning.adminTitle")}</h1>
        <Link to="/admin" className="text-blue-600 hover:underline text-sm">
          {t("excelPlanning.backAdmin")}
        </Link>
      </div>

      <section className="space-y-3 rounded-xl border-2 border-blue-200 bg-gradient-to-b from-blue-50/80 to-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("excelPlanning.quickStartTitle")}
        </h2>
        <p className="text-sm leading-snug text-slate-700 max-w-3xl">
          {t("excelPlanning.quickStartLead")}
        </p>
        <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-0.5 max-w-3xl">
          <li>{t("excelPlanning.quickStartStep1")}</li>
          <li>{t("excelPlanning.quickStartStep2")}</li>
          <li>{t("excelPlanning.quickStartStep3")}</li>
        </ol>
        <button
          type="button"
          onClick={() => void saveRecommendedTemplate()}
          disabled={saving}
          className="rounded-lg bg-blue-600 text-white px-4 py-2.5 text-sm font-medium shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {saving
            ? t("excelPlanning.saving")
            : t("excelPlanning.quickStartCta")}
        </button>
      </section>

      <section className="relative space-y-3 rounded-lg border border-slate-200 bg-white p-4 pb-20">
        <h2 className="font-semibold text-slate-900">
          {t("excelPlanning.templateSectionAdvanced")}
        </h2>
        <div className="grid min-h-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-3">
            <div
              ref={plantillaColRef}
              className="min-h-0 min-w-0 w-full"
            >
              <WorkerCardTemplateEditor
                className="w-full min-h-0"
                showIntro={false}
                value={workerCardLayout}
                onChange={setWorkerCardLayout}
                lineNameHints={workerCardLineNameHints}
                onLineNameHintsChange={setWorkerCardLineNameHints}
              />
            </div>

            <div
              ref={mapeoColRef}
              className={`excel-planning-mapeo-col min-h-0 min-w-0 border-slate-200 border-t pt-4 lg:min-h-0 lg:overflow-hidden lg:border-t-0 lg:pt-0 lg:pl-0${
                mapeoColHeightPx != null
                  ? " excel-planning-mapeo-col--height-synced"
                  : ""
              }`}
            >
              <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p
                  id="excel-mapping-json-heading"
                  className="shrink-0 text-sm font-medium text-slate-800"
                >
                  {t("excelPlanning.mappingJson")}
                </p>
                <textarea
                  className="mt-2 min-h-0 w-full min-w-0 flex-1 resize-y overflow-y-auto rounded border border-slate-200 bg-white px-2 py-2 font-mono text-xs leading-normal focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  rows={6}
                  value={mappingText}
                  onChange={(e) => setMappingText(e.target.value)}
                  onBlur={syncLayoutFromMappingJson}
                  spellCheck={false}
                  aria-labelledby="excel-mapping-json-heading"
                />
              </div>
            </div>
          </div>

        <div className="absolute bottom-3 right-3 z-10">
          <SaveIconButton
            type="button"
            onClick={() => void saveTemplate()}
            disabled={saving}
            title={
              saving
                ? t("excelPlanning.saving")
                : t("excelPlanning.saveTemplate")
            }
            aria-label={
              saving
                ? t("excelPlanning.saving")
                : t("excelPlanning.saveTemplate")
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="mx-auto flex w-fit max-w-full flex-col items-center gap-2 sm:mx-0 sm:shrink-0">
            <h2 className="text-center text-lg font-semibold text-slate-900">
              {t("excelPlanning.importSection")}
            </h2>
            <input
              ref={excelFileInputRef}
              type="file"
              className="sr-only"
              accept=".xlsx,.xls"
              tabIndex={-1}
              aria-label={t("excelPlanning.chooseExcelFile")}
              onChange={(e) => void onUpload(e)}
            />
            <button
              type="button"
              onClick={() => excelFileInputRef.current?.click()}
              className={withCommonIconButtonInteraction(`
                inline-flex h-11 w-11 shrink-0 items-center justify-center
                rounded-xl
                text-lg leading-none
                text-slate-700
                transition
                hover:bg-slate-100
                bg-white shadow-sm
                focus:outline-none focus:ring-2 focus:ring-slate-200
              `)}
              title={t("excelPlanning.chooseExcelFile")}
              aria-label={t("excelPlanning.chooseExcelFile")}
            >
              <span aria-hidden="true">📄</span>
            </button>
          </div>
          <div
            ref={publishedFilesPanelRef}
            className="relative flex w-full max-w-full shrink-0 flex-col items-center gap-2 sm:ml-auto sm:w-auto"
          >
            <h2 className="text-center text-lg font-semibold text-slate-900">
              {t("excelPlanning.publishedFilesFolderLabel")}
            </h2>
            <button
              type="button"
              onClick={() => setPublishedFilesOpen((o) => !o)}
              aria-expanded={publishedFilesOpen}
              aria-label={t("excelPlanning.publishedFilesFolderButton")}
              className={withCommonIconButtonInteraction(`
                inline-flex h-11 w-11 shrink-0 items-center justify-center
                rounded-xl
                text-lg leading-none
                text-slate-700
                transition
                hover:bg-slate-100
                bg-white shadow-sm
                focus:outline-none focus:ring-2 focus:ring-slate-200
              `)}
            >
              <span aria-hidden="true">📁</span>
            </button>
            {publishedFilesOpen && (
              <div
                className="absolute right-0 top-full z-30 mt-1 w-[min(100vw-2rem,20rem)] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
                role="region"
                aria-label={t("excelPlanning.publishedWeeks")}
              >
                <p className="mb-1.5 border-b border-slate-100 pb-1.5 text-xs font-semibold text-slate-600">
                  {t("excelPlanning.publishedWeeks")}
                </p>
                {weeks.length === 0 ? (
                  <p className="px-0.5 py-2 text-sm text-slate-500">
                    {t("excelPlanning.noWeeks")}
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto pr-0.5 text-sm">
                    {weeks.map((w) => {
                      const fileLabel = labelForPublishedWeekExcel(w);
                      const weekYmd = w.weekStart?.slice?.(0, 10) ?? w.weekStart;
                      const publishedLine = w.publishedAt
                        ? new Date(w.publishedAt).toLocaleString()
                        : null;
                      return (
                        <li key={w.weekStart} className="min-w-0">
                          {w.sourceFileUrl ? (
                            <button
                              type="button"
                              onClick={() => void openSecureFile(w.sourceFileUrl!)}
                              className="block w-full min-w-0 text-left"
                              title={t("excelPlanning.openOriginal")}
                            >
                              <span className="break-all font-medium text-blue-600 hover:underline">
                                📄 {fileLabel}
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-800">
                              {t("excelPlanning.publishedWeekNoFile", {
                                week: weekYmd,
                              })}
                            </span>
                          )}
                          <div className="mt-0.5 text-xs text-slate-500">
                            {t("excelPlanning.publishedWeekMeta", {
                              week: weekYmd,
                              at: publishedLine ?? "—",
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        {preview && !importPreviewModalOpen && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
            <span className="min-w-0 flex-1">{t("excelPlanning.importPendingBanner")}</span>
            <button
              type="button"
              className="shrink-0 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
              onClick={() => setImportPreviewModalOpen(true)}
            >
              {t("excelPlanning.reopenImportPreview")}
            </button>
          </div>
        )}
      </section>
      {preview && importPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-black/40"
            aria-hidden
            onClick={() => setImportPreviewModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-import-preview-title"
            className="relative z-10 flex max-h-[min(90vh,48rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h2
                id="excel-import-preview-title"
                className="text-base font-semibold text-slate-900 sm:text-lg"
              >
                {t("excelPlanning.importPreviewTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setImportPreviewModalOpen(false)}
                className="rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                aria-label={t("excelPlanning.importPreviewClose")}
              >
                {t("excelPlanning.importPreviewClose")}
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block text-sm font-medium leading-5 text-slate-800">
                    {t("excelPlanning.weekStartLabel")}
                    <input
                      className="mt-1 block w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 font-mono text-slate-900"
                      value={weekStartPublish}
                      onChange={(e) => setWeekStartPublish(e.target.value)}
                      placeholder={t("excelPlanning.weekStartPlaceholder")}
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </label>
                  {normalizedWeekStartYmd && (
                    <p className="text-xs text-slate-600">
                      Semana que se publicará:{" "}
                      <span className="font-semibold">
                        {weekRangeLabelFromMondayYmd(normalizedWeekStartYmd)}
                      </span>
                    </p>
                  )}
                  {weekStartInputYmd && normalizedWeekStartYmd && !inputAlreadyMonday && (
                    <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                      La fecha introducida no es lunes; se ajustará al lunes{" "}
                      {formatYmdToDmy(normalizedWeekStartYmd)}.
                    </p>
                  )}
                  {preview.weekStartDetected && (
                    <div>
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                        onClick={() =>
                          setWeekStartPublish(
                            formatYmdToDmy(
                              preview.weekStartDetected!.slice(0, 10),
                            ),
                          )
                        }
                      >
                        {t("excelPlanning.useDetectedWeek")}
                      </button>
                    </div>
                  )}
                </div>
                <div
                  className="min-w-0 flex-1 space-y-2"
                  aria-label={t("excelPlanning.importPreviewSummaryLabel")}
                >
                  {preview.stats && (
                    <div className="space-y-2">
                      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:pt-6">
                        <div className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-0.5">
                          <div className="inline-flex min-h-0 items-baseline gap-1.5">
                            <span className="whitespace-nowrap text-[0.65rem] font-medium uppercase leading-none text-slate-500">
                              {t("excelPlanning.importPreviewStatByNumber")}
                            </span>
                            <span className="text-sm font-semibold leading-none tabular-nums text-slate-900">
                              {preview.stats.matchedByNumber}
                            </span>
                          </div>
                          <div className="inline-flex min-h-0 items-baseline gap-1.5">
                            <span className="whitespace-nowrap text-[0.65rem] font-medium uppercase leading-none text-slate-500">
                              {t("excelPlanning.importPreviewStatUnmatched")}
                            </span>
                            <span
                              className={
                                (preview.stats.unmatched ?? 0) > 0
                                  ? "text-sm font-semibold leading-none tabular-nums text-rose-600"
                                  : "text-sm font-semibold leading-none tabular-nums text-slate-900"
                              }
                            >
                              {preview.stats.unmatched}
                            </span>
                          </div>
                        </div>
                        {importPreviewAllGreen && (
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold leading-none text-emerald-600 ring-1 ring-emerald-200/80"
                            role="img"
                            aria-label={t(
                              "excelPlanning.importPreviewStatsOkAria",
                            )}
                          >
                            <span aria-hidden="true">✓</span>
                          </div>
                        )}
                      </div>
                      {(preview.stats.numberKeyCollisions ?? 0) > 0 && (
                        <p className="text-sm text-amber-900">
                          {t("excelPlanning.statsCollisions", {
                            n: preview.stats.numberKeyCollisions,
                            sample: (preview.stats.collidingKeysSample ?? [])
                              .join(", "),
                          })}
                        </p>
                      )}
                    </div>
                  )}
                  {pairCells != null &&
                    preview &&
                    preview.rows.length > 0 &&
                    pairCells < preview.rows.length && (
                      <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm text-amber-900">
                        {t("excelPlanning.pairingPartial", {
                          withPair: pairCells,
                          total: preview.rows.length,
                        })}
                      </p>
                    )}
                  {!canPublish && preview.stats && lastImportId && (
                    <p className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-sm text-rose-900">
                      {t("excelPlanning.publishBlockedHint")}
                    </p>
                  )}
                </div>
              </div>
              {preview.parseErrors.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-2">
                  <p className="font-medium text-amber-900">
                    {t("excelPlanning.parseWarnings")}
                  </p>
                  <ul className="list-disc pl-5 text-amber-800">
                    {preview.parseErrors.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="max-h-72 overflow-auto rounded border sm:max-h-96">
                <table className="w-full min-w-[56rem] table-fixed text-xs">
                  <colgroup>
                    <col className="w-24" />
                    <col className="w-16" />
                    <col className="w-28" />
                    <col className="w-24" />
                    <col className="w-20" />
                    <col className="w-20" />
                    <col className="min-w-0" />
                    <col className="min-w-0" />
                    <col className="w-28" />
                    <col className="min-w-0" />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.day")}
                      </th>
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.dienst")}
                      </th>
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.time")}
                      </th>
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.vehicle")}
                      </th>
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.empNum")}
                      </th>
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.partnerEmp")}
                      </th>
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.name")}
                      </th>
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.partner")}
                      </th>
                      <th className="p-1.5 text-left align-bottom">
                        {t("excelPlanning.col.match")}
                      </th>
                      <th className="p-1.5 break-words text-left align-bottom">
                        {t("excelPlanning.col.warning")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 80).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 align-top">
                        <td className="p-1.5 whitespace-nowrap">
                          {r.dayDate?.slice?.(0, 10) ?? r.dayIndex}
                        </td>
                        <td className="p-1.5 whitespace-nowrap">{r.dienstNumber}</td>
                        <td className="p-1.5 break-words">{r.timeText}</td>
                        <td className="p-1.5 break-words">{r.vehicleCode}</td>
                        <td className="p-1.5 whitespace-nowrap">
                          {r.employeeNumber}
                        </td>
                        <td className="p-1.5 whitespace-nowrap">
                          {r.partnerEmployeeNumber}
                        </td>
                        <td
                          className="min-w-0 break-words p-1.5 text-left"
                          title={r.displayNameFromExcel}
                        >
                          {r.displayNameFromExcel}
                        </td>
                        <td
                          className="min-w-0 break-words p-1.5 text-left"
                          title={r.displayPartnerNameFromExcel}
                        >
                          {r.displayPartnerNameFromExcel}
                        </td>
                        <td className="p-1.5 break-words">{r.matchMethod}</td>
                        <td className="p-1.5 text-[11px] text-amber-900 min-w-0 break-words">
                          {r.matchWarning ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={!canPublish}
                  title={
                    canPublish
                      ? undefined
                      : t("excelPlanning.publishDisabledTitle")
                  }
                  className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("excelPlanning.publishOneClick")}
                </button>
                {preview.fileUrl && (
                  <button
                    type="button"
                    className="text-sm text-blue-600 underline"
                    onClick={() => void openSecureFile(preview.fileUrl!)}
                  >
                    {t("excelPlanning.openOriginal")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
