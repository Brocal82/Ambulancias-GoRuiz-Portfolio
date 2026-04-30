/**
 * Genera dos .xlsx de prueba con geometría distinta y orden de líneas en celda distinto,
 * para empresas de ejemplo "Villanos" y "Avengers". Cada una debe usarse con su
 * `fixtures/excel-planning-mapping-<empresa>.example.json` en /admin/excel-planning.
 *
 *   node scripts/generate-sample-excels-villanos-avengers.js
 *
 * Salida:
 *   fixtures/sample-excel-villanos.xlsx  — 1.ª semana (lunes 2026-04-20), SOLO Dienst Früh.
 *   fixtures/sample-excel-villanos-week2.xlsx — 2.ª semana (lunes 2026-04-27), SOLO Dienst Nacht.
 *   fixtures/sample-excel-avengers.xlsx
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const outDir = path.join(__dirname, "..", "fixtures");
const outV = path.join(outDir, "sample-excel-villanos.xlsx");
const outVWeek2 = path.join(outDir, "sample-excel-villanos-week2.xlsx");
const outA = path.join(outDir, "sample-excel-avengers.xlsx");

/** Orden default admin: time → vehicle → … */
function cellVillanos(time, vehicle, emp, name, partner, partnerEmp) {
  const parts = [time, vehicle, emp, name];
  if (partner) parts.push(partner);
  if (partnerEmp != null && String(partnerEmp).trim() !== "") {
    parts.push(String(partnerEmp).trim());
  }
  return parts.join("\n");
}

/** Avengers: Fahrzeug zuerst (vehicle) → time → … — coherente con mapping-avengers */
function cellAvengers(vehicle, time, emp, name, partner, partnerEmp) {
  const parts = [vehicle, time, emp, name];
  if (partner) parts.push(partner);
  if (partnerEmp != null && String(partnerEmp).trim() !== "") {
    parts.push(String(partnerEmp).trim());
  }
  return parts.join("\n");
}

/** Misma pareja 0001+0002 en cada celda: conductor / compañero (equipo fijo, Lu–Vi). */
const N1 = "García, L.";
const N2 = "Soto, M.";

/**
 * Grilla Villanos semana 1 (20.04–26.04.2026): SOLO Dienst 1 (Früh).
 * La semana 2 (27.04–03.05.2026) se genera en otro archivo con SOLO Dienst 2 (Nacht).
 */
const aoaVillanos = [
  [
    "VILLANOS SA — 1.ª semana: 20.04–26.04.2026 | weekStart 2026-04-20 | SOLO Dienst Früh | Pareja 0001+0002 (García / Soto) — Lu–V",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    "Nr",
    "Dienstzeit / Wagen",
    "Mo",
    "Di",
    "Mi",
    "Do",
    "Fr",
    "Sa",
    "So",
  ],
  [
    "1",
    "Früh — pareja 0001+0002",
    cellVillanos("08:00-16:00", "RTW-11", "0001", N1, N2, "0002"),
    cellVillanos("08:00-16:00", "RTW-11", "0002", N2, N1, "0001"),
    cellVillanos("08:00-16:00", "NEF-2", "0001", N1, N2, "0002"),
    cellVillanos("08:00-16:00", "RTW-11", "0002", N2, N1, "0001"),
    cellVillanos("08:00-16:00", "RTW-11", "0001", N1, N2, "0002"),
    "",
    "",
  ],
  [
    "2",
    "Nacht (vacío en semana 1)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
];

const aoaVillanosWeek2 = [
  [
    "VILLANOS SA — 2.ª semana: 27.04–03.05.2026 | weekStart 2026-04-27 | SOLO Dienst Nacht | Pareja 0001+0002 (García / Soto) — Lu–V",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    "Nr",
    "Dienstzeit / Wagen",
    "Mo",
    "Di",
    "Mi",
    "Do",
    "Fr",
    "Sa",
    "So",
  ],
  [
    "1",
    "Früh (vacío en semana 2)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    "2",
    "Nacht — pareja 0001+0002",
    cellVillanos("20:00-08:00", "NEF-2", "0001", N1, N2, "0002"),
    cellVillanos("20:00-08:00", "NEF-2", "0002", N2, N1, "0001"),
    cellVillanos("20:00-08:00", "NEF-2", "0001", N1, N2, "0002"),
    cellVillanos("20:00-08:00", "NEF-2", "0002", N2, N1, "0001"),
    cellVillanos("20:00-08:00", "NEF-2", "0001", N1, N2, "0002"),
    "",
    "",
  ],
];

/**
 * Grilla Avengers: 3 filas de cabecera; datos desde fila 3 (0-based 3 = 4.ª fila en Excel).
 * Dienst col A, Callsign B, días C–I. Línea en celda: vehicle, time, …
 */
const aoaAvengers = [
  [
    "STARK / S.H.I.E.L.D. — Field rotation (sample)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  ["Week note", "KW 17 / sample week", "", "", "", "", "", "", ""],
  [
    "Svc#",
    "Callsign",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ],
  [
    "A-1",
    "Alpha-7",
    cellAvengers(
      "QUIN-01",
      "06:30-15:00",
      "7",
      "Stark, Tony",
      "Rogers, Steve",
      "8",
    ),
    cellAvengers(
      "QUIN-01",
      "06:30-15:00",
      "8",
      "Rogers, Steve",
      "Stark, Tony",
      "7",
    ),
    cellAvengers(
      "JET-22",
      "07:00-15:30",
      "7",
      "Stark, Tony",
      "Danvers, C.",
      "9",
    ),
    "",
    "",
    "",
    "",
  ],
  [
    "A-2",
    "Bravo-3",
    "",
    cellAvengers("MBW-1", "14:00-22:00", "8", "Rogers, Steve", "Stark, Tony", "7"),
    cellAvengers("JET-22", "14:00-22:00", "7", "Stark, Tony", "Rogers, Steve", "8"),
    "",
    "",
    "",
    "",
  ],
];

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function writeBook(aoa, filePath, sheetName) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
  console.log("✅", filePath);
}

writeBook(aoaVillanos, outV, "Plan");
writeBook(aoaVillanosWeek2, outVWeek2, "Plan");
writeBook(aoaAvengers, outA, "FieldSchedule");

console.log(
  "\nVillanos semana 1 (Früh): publica sample-excel-villanos.xlsx con weekStart 2026-04-20.",
  "\nVillanos semana 2 (Nacht): publica sample-excel-villanos-week2.xlsx con weekStart 2026-04-27.",
  "\n\nEn cada empresa, pega en «Mapeo (JSON)» el JSON de",
  "\n  fixtures/excel-planning-mapping-villanos.example.json  o",
  "\n  fixtures/excel-planning-mapping-avengers.example.json",
  "\ny guarda la plantilla antes de importar el .xlsx correspondiente.",
  "\nTrabajadores: nº de empresa 1 y 2 (o 0001/0002) para que coincidan con 0001/0002 del Excel (según normalización).",
);
