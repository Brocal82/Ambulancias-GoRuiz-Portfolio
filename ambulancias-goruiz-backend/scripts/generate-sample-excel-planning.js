/**
 * Genera un .xlsx de prueba alineado con la plantilla por defecto del admin
 * (dataStartRow 2, columnas A/B + Mo–So en C–I, celdas multilínea).
 *
 *   node scripts/generate-sample-excel-planning.js
 *
 * Salida: fixtures/sample-excel-planning.xlsx
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const outDir = path.join(__dirname, "..", "fixtures");
const outFile = path.join(outDir, "sample-excel-planning.xlsx");

// Orden: time, vehicle, employeeNumber, name, partnerName [, partnerEmployeeNumber]
function cell(time, vehicle, emp, name, partner, partnerEmp) {
  const parts = [time, vehicle, emp, name];
  if (partner) parts.push(partner);
  if (partnerEmp != null && String(partnerEmp).trim() !== "") {
    parts.push(String(partnerEmp).trim());
  }
  return parts.join("\n");
}

/** Misma grilla que DEFAULT_MAPPING en AdminExcelPlanningPage (índices 0-based). */
const aoa = [
  ["Dienstplan Demo (Probe)", "", "", "", "", "", "", "", ""],
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
    cell(
      "06:45-14:45",
      "RTW-11",
      "0002",
      "Schmidt, Ben",
      "Mustermann, Anna",
      "0001",
    ),
    cell(
      "06:45-14:45",
      "RTW-12",
      "0001",
      "Mustermann, Anna",
      "Müller, Chris",
      "0002",
    ),
    "",
    "",
    "",
    "",
  ],
  [
    "2",
    "Spät",
    "",
    cell(
      "14:30-22:30",
      "RTW-11",
      "0001",
      "Mustermann, Anna",
      "Schmidt, Ben",
      "0002",
    ),
    cell(
      "14:30-22:30",
      "RTW-12",
      "0002",
      "Schmidt, Ben",
      "Mustermann, Anna",
      "0001",
    ),
    "",
    "",
    "",
    "",
  ],
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
  "   Usa la plantilla JSON por defecto del admin y publica con weekStart = lunes de esa semana (p. ej. 2026-04-20).",
);
