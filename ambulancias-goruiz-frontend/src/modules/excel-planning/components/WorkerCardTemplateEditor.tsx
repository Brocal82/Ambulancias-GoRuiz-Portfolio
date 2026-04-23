import { useTranslation } from "react-i18next";
import {
  WORKER_CARD_FIELD_OPTIONS,
  type WorkerCardLayout,
  type WorkerCardLineNameHints,
  buildExcelCellLinesForLayout,
} from "../domain/workerCardLayout";
import type { DienstDayCellLines } from "../../diensts/components";
import type { ExcelPlanRow } from "../domain/api";

const DEMO_ROW: ExcelPlanRow = {
  dayIndex: 0,
  dayDate: "2026-04-20T00:00:00.000Z",
  dienstNumber: "1",
  rowLabel: "Früh",
  timeText: "08:40-16:00",
  vehicleCode: "RTW-11",
  employeeNumber: "1",
  partnerEmployeeNumber: "2",
  displayNameFromExcel: "Cobblepot, Oswald",
  displayPartnerNameFromExcel: "Loki, Loki",
  rawCellText: "demo",
  matchMethod: "employee_number",
  primaryAmbulanceRole: "driver",
  partnerAmbulanceRole: "medic",
};

const DEMO_MONDAY = "2026-04-20";

const LAYOUT_KEYS: (keyof WorkerCardLayout)[] = [
  "dayDateField",
  "timeField",
  "vehicleField",
  "driverField",
  "medicField",
];

const PREVIEW_KEY: Record<
  keyof WorkerCardLayout,
  keyof DienstDayCellLines
> = {
  dayDateField: "dateLine",
  timeField: "timeLine",
  vehicleField: "ambulanceLine",
  driverField: "driverLine",
  medicField: "medicLine",
};

type Props = {
  value: WorkerCardLayout;
  onChange: (next: WorkerCardLayout) => void;
  lineNameHints: WorkerCardLineNameHints;
  onLineNameHintsChange: (next: WorkerCardLineNameHints) => void;
};

export default function WorkerCardTemplateEditor({
  value,
  onChange,
  lineNameHints,
  onLineNameHintsChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const demoRows: ExcelPlanRow[] = [DEMO_ROW];
  const previewLines = buildExcelCellLinesForLayout(
    DEMO_MONDAY,
    i18n.language,
    demoRows,
    value,
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {t("excelPlanning.cardTemplate.intro")}
      </p>
      <p className="text-xs text-slate-500">
        {t("excelPlanning.cardTemplate.hintKeys")}
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
        <p className="text-sm font-medium text-slate-800">
          {t("excelPlanning.cardTemplate.exampleWeekTitle")}
        </p>
        <p className="text-xs text-slate-500">
          {t("excelPlanning.cardTemplate.tableIntro")}
        </p>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[640px] text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-600 border-b border-slate-200">
                <th className="py-2 pr-2 font-medium w-[28%]">
                  {t("excelPlanning.cardTemplate.colPreview")}
                </th>
                <th className="py-2 pr-2 font-medium w-[26%]">
                  {t("excelPlanning.cardTemplate.colFieldKey")}
                </th>
                <th className="py-2 font-medium w-[46%]">
                  {t("excelPlanning.cardTemplate.colYourName")}
                </th>
              </tr>
            </thead>
            <tbody>
              {LAYOUT_KEYS.map((k) => {
                const line = previewLines[PREVIEW_KEY[k]];
                return (
                  <tr
                    key={k}
                    className="border-b border-slate-100 last:border-0 align-top"
                  >
                    <td className="py-2.5 pr-2">
                      <div
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-800 shadow-sm font-normal whitespace-pre-wrap break-words"
                        aria-label={t(`excelPlanning.cardTemplate.slotLabel.${k}`)}
                      >
                        {line}
                      </div>
                    </td>
                    <td className="py-2.5 pr-2">
                      <label className="sr-only" htmlFor={`wct-field-${k}`}>
                        {t(`excelPlanning.cardTemplate.slotLabel.${k}`)}
                      </label>
                      <select
                        id={`wct-field-${k}`}
                        className="w-full min-w-0 max-w-md border rounded px-2 py-1.5 text-xs font-mono"
                        value={value[k]}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            [k]: e.target.value as WorkerCardLayout[typeof k],
                          })
                        }
                        aria-label={t(`excelPlanning.cardTemplate.slotLabel.${k}`)}
                      >
                        {WORKER_CARD_FIELD_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <p className="text-slate-500 text-[11px] mt-1">
                        {t(`excelPlanning.cardTemplate.slotHelp.${k}`)}
                      </p>
                    </td>
                    <td className="py-2.5">
                      <label className="sr-only" htmlFor={`wct-hint-${k}`}>
                        {t("excelPlanning.cardTemplate.colYourName")}
                      </label>
                      <input
                        id={`wct-hint-${k}`}
                        type="text"
                        className="w-full border rounded px-2 py-1.5 text-xs"
                        placeholder={t(
                          "excelPlanning.cardTemplate.yourNamePlaceholder",
                        )}
                        value={lineNameHints[k]}
                        onChange={(e) =>
                          onLineNameHintsChange({
                            ...lineNameHints,
                            [k]: e.target.value.slice(0, 200),
                          })
                        }
                        maxLength={200}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          {t("excelPlanning.cardTemplate.exampleNote")}
        </p>
      </div>
    </div>
  );
}
