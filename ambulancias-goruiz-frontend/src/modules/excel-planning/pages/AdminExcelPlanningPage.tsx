import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getApiErrorMessage } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import {
  getExcelPlanningTemplate,
  putExcelPlanningTemplate,
  postExcelPlanningImport,
  postExcelPlanningExport,
  publishExcelPlanningImport,
  listExcelPlanningWeeks,
  type ExcelPlanningMapping,
  type ExcelPlanRow,
  type ExcelExportRow,
} from "../domain/api";
import {
  DEFAULT_WORKER_CARD_LAYOUT,
  EMPTY_WORKER_CARD_LINE_NAME_HINTS,
  normalizeWorkerCardLayout,
  normalizeWorkerCardLineNameHints,
  type WorkerCardLayout,
  type WorkerCardLineNameHints,
} from "../domain/workerCardLayout";
import WorkerCardTemplateEditor from "../components/WorkerCardTemplateEditor";

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

const EXPORT_ROWS_EXAMPLE: ExcelExportRow[] = [
  {
    dayIndex: 0,
    dienstNumber: "1",
    rowLabel: "Früh",
    timeText: "06:45-14:45",
    vehicleCode: "RTW-11",
    employeeNumber: "1",
    partnerEmployeeNumber: "2",
    displayNameFromExcel: "Mustermann, Anna",
    displayPartnerNameFromExcel: "Schmidt, Ben",
  },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [mappingText, setMappingText] = useState(
    JSON.stringify(DEFAULT_MAPPING, null, 2),
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
  const [weekStartPublish, setWeekStartPublish] = useState(mondayUtcThisWeek());
  const [weeks, setWeeks] = useState<
    Array<{ weekStart: string; publishedAt?: string }>
  >([]);
  const [exportWeekStart, setExportWeekStart] = useState(() => mondayUtcThisWeek());
  const [exportRowsText, setExportRowsText] = useState(
    JSON.stringify(EXPORT_ROWS_EXAMPLE, null, 2),
  );
  const [exporting, setExporting] = useState(false);
  const [workerCardLayout, setWorkerCardLayout] = useState<WorkerCardLayout>(
    () => ({ ...DEFAULT_WORKER_CARD_LAYOUT }),
  );
  const [workerCardLineNameHints, setWorkerCardLineNameHints] =
    useState<WorkerCardLineNameHints>(() => ({
      ...EMPTY_WORKER_CARD_LINE_NAME_HINTS,
    }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tpl = await getExcelPlanningTemplate();
      if (tpl?.mapping) {
        setName(tpl.name ?? "");
        setMappingText(JSON.stringify(tpl.mapping, null, 2));
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
      setMappingText(JSON.stringify(mapping, null, 2));
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
      if (data.weekStartDetected) {
        setWeekStartPublish(data.weekStartDetected.slice(0, 10));
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
    try {
      await publishExcelPlanningImport(lastImportId, {
        weekStart: weekStartPublish.trim() || undefined,
      });
      toast.success(t("excelPlanning.published"));
      setLastImportId(null);
      setPreview(null);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("excelPlanning.publishError")));
    }
  };

  const downloadExport = async () => {
    let rows: ExcelExportRow[];
    try {
      rows = JSON.parse(exportRowsText) as ExcelExportRow[];
      if (!Array.isArray(rows) || rows.length === 0) {
        toast.error(t("excelPlanning.exportInvalidRows"));
        return;
      }
    } catch {
      toast.error(t("excelPlanning.exportInvalidJson"));
      return;
    }
    setExporting(true);
    try {
      const { blob, filename } = await postExcelPlanningExport({
        weekStart: exportWeekStart.trim(),
        rows,
      });
      downloadBlob(blob, filename);
      toast.success(t("excelPlanning.exportSuccess"));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("excelPlanning.exportError")));
    } finally {
      setExporting(false);
    }
  };

  const canPublish =
    Boolean(lastImportId) &&
    Boolean(preview?.rows?.length) &&
    (preview?.stats?.unmatched ?? 0) === 0 &&
    (preview?.stats?.numberKeyCollisions ?? 0) === 0;

  if (loading) {
    return (
      <p className="text-center text-slate-600">{t("excelPlanning.loading")}</p>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{t("excelPlanning.adminTitle")}</h1>
        <Link to="/admin" className="text-blue-600 hover:underline text-sm">
          {t("excelPlanning.backAdmin")}
        </Link>
      </div>

      <p className="text-sm text-slate-600">{t("excelPlanning.adminIntro")}</p>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{t("excelPlanning.templateSection")}</h2>
        <label className="block text-sm">
          {t("excelPlanning.templateName")}
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="pt-1">
          <h3 className="text-sm font-medium text-slate-800 mb-1">
            {t("excelPlanning.cardTemplate.sectionTitle")}
          </h3>
          <WorkerCardTemplateEditor
            value={workerCardLayout}
            onChange={setWorkerCardLayout}
            lineNameHints={workerCardLineNameHints}
            onLineNameHintsChange={setWorkerCardLineNameHints}
          />
        </div>
        <label className="block text-sm">
          {t("excelPlanning.mappingJson")}
          <textarea
            className="mt-1 w-full font-mono text-xs border rounded px-2 py-2 min-h-[220px]"
            value={mappingText}
            onChange={(e) => setMappingText(e.target.value)}
            onBlur={syncLayoutFromMappingJson}
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          onClick={() => void saveTemplate()}
          disabled={saving}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? t("excelPlanning.saving") : t("excelPlanning.saveTemplate")}
        </button>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{t("excelPlanning.exportSection")}</h2>
        <p className="text-sm text-slate-600">{t("excelPlanning.exportIntro")}</p>
        <label className="block text-sm">
          {t("excelPlanning.exportWeekStart")}
          <input
            className="mt-1 border rounded px-2 py-1 font-mono block"
            value={exportWeekStart}
            onChange={(e) => setExportWeekStart(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        </label>
        <label className="block text-sm">
          {t("excelPlanning.exportRowsJson")}
          <textarea
            className="mt-1 w-full font-mono text-xs border rounded px-2 py-2 min-h-[180px]"
            value={exportRowsText}
            onChange={(e) => setExportRowsText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-slate-700 text-white px-4 py-2 text-sm disabled:opacity-50"
            disabled={exporting}
            onClick={() => void downloadExport()}
          >
            {exporting ? t("excelPlanning.exporting") : t("excelPlanning.exportDownload")}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() =>
              setExportRowsText(JSON.stringify(EXPORT_ROWS_EXAMPLE, null, 2))
            }
          >
            {t("excelPlanning.exportExample")}
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{t("excelPlanning.importSection")}</h2>
        <input
          type="file"
          accept=".xlsx,.xls"
          aria-label={t("excelPlanning.importSection")}
          onChange={(e) => void onUpload(e)}
        />
        {preview && (
          <div className="space-y-2 text-sm">
            {preview.parseErrors.length > 0 && (
              <div className="rounded bg-amber-50 border border-amber-200 p-2">
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
            {preview.stats && (
              <p className="text-slate-700">
                {t("excelPlanning.statsLine", {
                  total: preview.stats.totalCells,
                  byNum: preview.stats.matchedByNumber,
                  byName: preview.stats.matchedByName,
                  un: preview.stats.unmatched,
                })}
                {(preview.stats.numberKeyCollisions ?? 0) > 0
                  ? ` ${t("excelPlanning.statsCollisions", {
                      n: preview.stats.numberKeyCollisions,
                      sample: (preview.stats.collidingKeysSample ?? [])
                        .join(", "),
                    })}`
                  : ""}
              </p>
            )}
            {!canPublish && preview.stats && lastImportId && (
              <p className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-rose-900 text-sm">
                {t("excelPlanning.publishBlockedHint")}
              </p>
            )}
            {preview.fileUrl && (
              <button
                type="button"
                className="text-blue-600 underline text-sm"
                onClick={() => void openSecureFile(preview.fileUrl!)}
              >
                {t("excelPlanning.openOriginal")}
              </button>
            )}
            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-1 text-left">{t("excelPlanning.col.day")}</th>
                    <th className="p-1 text-left">{t("excelPlanning.col.dienst")}</th>
                    <th className="p-1 text-left">{t("excelPlanning.col.time")}</th>
                    <th className="p-1 text-left">{t("excelPlanning.col.vehicle")}</th>
                    <th className="p-1 text-left">{t("excelPlanning.col.empNum")}</th>
                    <th className="p-1 text-left">{t("excelPlanning.col.partnerEmp")}</th>
                    <th className="p-1 text-left">{t("excelPlanning.col.name")}</th>
                    <th className="p-1 text-left">{t("excelPlanning.col.partner")}</th>
                    <th className="p-1 text-left">{t("excelPlanning.col.match")}</th>
                    <th className="p-1 text-left max-w-[180px]">
                      {t("excelPlanning.col.warning")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 80).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-1 whitespace-nowrap">
                        {r.dayDate?.slice?.(0, 10) ?? r.dayIndex}
                      </td>
                      <td className="p-1">{r.dienstNumber}</td>
                      <td className="p-1">{r.timeText}</td>
                      <td className="p-1">{r.vehicleCode}</td>
                      <td className="p-1">{r.employeeNumber}</td>
                      <td className="p-1">{r.partnerEmployeeNumber}</td>
                      <td className="p-1 max-w-[140px] truncate" title={r.displayNameFromExcel}>
                        {r.displayNameFromExcel}
                      </td>
                      <td className="p-1 max-w-[140px] truncate" title={r.displayPartnerNameFromExcel}>
                        {r.displayPartnerNameFromExcel}
                      </td>
                      <td className="p-1">{r.matchMethod}</td>
                      <td className="p-1 max-w-[180px] text-amber-900 text-[11px]">
                        {r.matchWarning ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="block text-sm">
              {t("excelPlanning.weekStartLabel")}
              <input
                className="mt-1 border rounded px-2 py-1 font-mono"
                value={weekStartPublish}
                onChange={(e) => setWeekStartPublish(e.target.value)}
                placeholder="YYYY-MM-DD"
                aria-describedby="week-start-hint"
              />
              <span id="week-start-hint" className="block text-slate-500 text-xs mt-0.5">
                {t("excelPlanning.weekStartHint")}
              </span>
            </label>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={!canPublish}
              title={
                canPublish
                  ? undefined
                  : t("excelPlanning.publishDisabledTitle")
              }
              className="rounded bg-emerald-600 text-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("excelPlanning.publish")}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{t("excelPlanning.publishedWeeks")}</h2>
        {weeks.length === 0 ? (
          <p className="text-sm text-slate-500">{t("excelPlanning.noWeeks")}</p>
        ) : (
          <ul className="text-sm space-y-1">
            {weeks.map((w) => (
              <li key={w.weekStart}>
                {w.weekStart?.slice?.(0, 10) ?? w.weekStart}
                {w.publishedAt
                  ? ` — ${new Date(w.publishedAt).toLocaleString()}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
