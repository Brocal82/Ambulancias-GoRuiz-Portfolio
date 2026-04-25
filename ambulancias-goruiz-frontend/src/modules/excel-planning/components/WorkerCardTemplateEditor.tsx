import { useTranslation } from "react-i18next";
import {
  WORKER_CARD_FIELD_OPTIONS,
  type WorkerCardLayout,
  type WorkerCardLineNameHints,
  buildExcelCellLinesForLayout,
} from "../domain/workerCardLayout";
import { DienstDayCell, type DienstDayCellLines } from "../../diensts/components";
import { getStatusClass } from "../../diensts/utils";
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
  className?: string;
  /** Si es false, solo se renderiza el bloque gris (tabla); el intro se muestra en el padre. */
  showIntro?: boolean;
};

export default function WorkerCardTemplateEditor({
  value,
  onChange,
  lineNameHints,
  onLineNameHintsChange,
  className,
  showIntro = true,
}: Props) {
  const { t, i18n } = useTranslation();
  const demoRows: ExcelPlanRow[] = [DEMO_ROW];
  const previewLines = buildExcelCellLinesForLayout(
    DEMO_MONDAY,
    i18n.language,
    demoRows,
    value,
  );

  const tableBlock = (
    <div
      className={
        showIntro
          ? "min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
          : "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2.5"
      }
    >
        <p className="shrink-0 text-sm font-medium text-slate-800">
          {t("excelPlanning.cardTemplate.exampleWeekTitle")}
        </p>
        <div
          className={
            showIntro
              ? "-mx-0.5 overflow-x-auto px-0.5 pt-2"
              : "min-h-0 -mx-0.5 overflow-x-auto overflow-y-auto px-0.5 pt-2"
          }
        >
          <table className="w-full min-w-0 sm:min-w-[32rem] text-xs border-collapse table-fixed">
            <colgroup>
              <col className="w-[32%] sm:w-[30%]" />
              <col className="w-[32%] sm:w-[30%]" />
              <col className="w-[36%] sm:w-[40%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-slate-600 border-b border-slate-200">
                <th className="py-1.5 pr-1.5 sm:pr-2 font-medium align-bottom">
                  {t("excelPlanning.cardTemplate.colPreview")}
                </th>
                <th className="py-1.5 pr-1.5 sm:pr-2 font-medium align-bottom">
                  {t("excelPlanning.cardTemplate.colFieldKey")}
                </th>
                <th className="py-1.5 font-medium align-bottom">
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
                    <td className="py-1.5 pr-1.5 sm:pr-2">
                      <div
                        className="rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-800 shadow-sm font-normal text-xs leading-snug whitespace-pre-wrap break-words"
                        aria-label={t(`excelPlanning.cardTemplate.slotLabel.${k}`)}
                      >
                        {line}
                      </div>
                    </td>
                    <td className="py-1.5 pr-1.5 sm:pr-2">
                      <div className="min-w-0">
                        <label className="sr-only" htmlFor={`wct-field-${k}`}>
                          {t(`excelPlanning.cardTemplate.slotLabel.${k}`)}
                        </label>
                        <select
                          id={`wct-field-${k}`}
                          className="w-full min-w-0 max-w-full border rounded px-1.5 py-1 text-xs font-mono"
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
                      </div>
                    </td>
                    <td className="py-1.5">
                      <label className="sr-only" htmlFor={`wct-hint-${k}`}>
                        {t("excelPlanning.cardTemplate.colYourName")}
                      </label>
                      <input
                        id={`wct-hint-${k}`}
                        type="text"
                        className="w-full min-w-0 max-w-full border rounded px-1.5 py-1 text-xs"
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
        <div className="mt-1.5 flex w-full justify-center">
          <div className="flex max-w-full flex-col items-center gap-1.5">
            <p className="text-sm font-medium text-slate-800">
              {t("excelPlanning.cardTemplate.workerViewTitle")}
            </p>
            <DienstDayCell
              dayISO={DEMO_MONDAY}
              statusClass={getStatusClass("full")}
              isPast={false}
              isPartial={false}
              isDisabled={false}
              preferLineWrap
              isStaticPreview
              lines={previewLines}
              onOpen={() => {}}
            />
          </div>
        </div>
      </div>
  );

  if (!showIntro) {
    return (
      <div
        className={`flex w-full min-h-0 flex-col${className ? ` ${className}` : ""}`}
      >
        {tableBlock}
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 flex-col space-y-2${className ? ` ${className}` : ""}`}
    >
      <p className="text-sm leading-snug text-slate-600">
        {t("excelPlanning.cardTemplate.intro")}
      </p>
      {tableBlock}
    </div>
  );
}
