/**
 * Segunda semana (ej. lunes 27/04/2026): 5 días laborables con la MISMA pareja en una sola
 * fila de Dienst (1 · Früh); sábado y domingo vacíos (libres).
 *
 * En cada celda la línea del nº lleva "0001 / 0002" (ambos visibles en la cuadrícula); el
 * import las separa en titular + compañero. También vale "0001+0002" o "0001, 0002".
 *
 * Publicar en admin con weekStart = 2026-04-27 (lunes de esa semana ISO).
 *
 *   node scripts/generate-sample-excel-second-week-five-days-pair.js
 *
 * Salida: fixtures/sample-excel-second-week-five-days-pair.xlsx
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const outDir = path.join(__dirname, "..", "fixtures");
const outFile = path.join(
  outDir,
  "sample-excel-second-week-five-days-pair.xlsx",
);

function cell(time, vehicle, emp, name, partner, partnerEmp) {
  const parts = [time, vehicle, emp, name];
  if (partner) parts.push(partner);
  if (partnerEmp != null && String(partnerEmp).trim() !== "") {
    parts.push(String(partnerEmp).trim());
  }
  return parts.join("\n");
}

/** Mismo equipo cada día: ambos nº en la 3.ª línea ("0001 / 0002") para verlos en la hoja; nombres debajo. */
const sameTeamCell = () =>
  cell(
    "06:45-14:45",
    "RTW-11",
    "0001 / 0002",
    "Mustermann, Anna",
    "Schmidt, Ben",
  );

const emptyWeek = ["", "", "", "", "", "", ""];

/** Mo–Fr: la misma pareja en el mismo día (celda idéntica); Sa–So libres. */
const aoa = [
  [
    "27.04–03.05.2026 | weekStart 2026-04-27 | Lu–Fr: línea nº \"0001 / 0002\" + nombres (mismo equipo) | Sa/So libre",
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
    sameTeamCell(),
    sameTeamCell(),
    sameTeamCell(),
    sameTeamCell(),
    sameTeamCell(),
    "",
    "",
  ],
  ["2", "Spät", ...emptyWeek],
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
  "   Publicar con weekStart=2026-04-27. Celda: línea visible \"0001 / 0002\" + nombres; import reconoce ambos.",
);
