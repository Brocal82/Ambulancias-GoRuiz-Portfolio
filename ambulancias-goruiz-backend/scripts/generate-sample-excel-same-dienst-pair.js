/**
 * Excel de prueba: UN día (lunes) con 0001 y 0002 en la MISMA celda del mismo Dienst (1 · Früh).
 * El resto de días y la fila Spät quedan vacíos — útil para comprobar pareja en worker / import.
 *
 *   node scripts/generate-sample-excel-same-dienst-pair.js
 *
 * Salida: fixtures/sample-excel-same-dienst-pair.xlsx
 *
 * Plantilla admin: mismo DEFAULT_MAPPING (cellLineOrder con partnerEmployeeNumber al final).
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const outDir = path.join(__dirname, "..", "fixtures");
const outFile = path.join(outDir, "sample-excel-same-dienst-pair.xlsx");

function cell(time, vehicle, emp, name, partner, partnerEmp) {
  const parts = [time, vehicle, emp, name];
  if (partner) parts.push(partner);
  if (partnerEmp != null && String(partnerEmp).trim() !== "") {
    parts.push(String(partnerEmp).trim());
  }
  return parts.join("\n");
}

/** Grilla alineada con AdminExcelPlanningPage: dataStartRow 2, Mo–So cols C–I. */
const emptyDays = ["", "", "", "", "", ""];

const aoa = [
  [
    "Demo: pareja mismo Dienst (solo lunes)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  ["Nr", "Dienstzeit / Wagen", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  [
    "1",
    "Früh",
    cell(
      "06:45-14:45",
      "RTW-11",
      "0001",
      "Mustermann, Anna",
      "Schmidt, Ben",
      "0002",
    ),
    ...emptyDays,
  ],
  ["2", "Spät", "", ...emptyDays],
];

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(aoa);
XLSX.utils.book_append_sheet(wb, ws, "Plan");
XLSX.writeFile(wb, outFile);

console.log("✅ Escrito:", outFile);
console.log(
  "   Lunes · Dienst 1 Früh: 0001 + 0002 en una sola celda. Publicar con weekStart = lunes de esa semana.",
);
