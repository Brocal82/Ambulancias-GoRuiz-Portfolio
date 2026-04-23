/**
 * Genera fixtures/excel-planning-real-0001-0002.xlsx usando trabajadores reales
 * con números de empleado 0001 y 0002 (también acepta 1, 2 tras normalizar).
 *
 * Uso:
 *   npx ts-node scripts/generate-excel-planning-real-workers.ts
 *   COMPANY_ID=<mongoObjectId> npx ts-node scripts/generate-excel-planning-real-workers.ts
 *   npx ts-node scripts/generate-excel-planning-real-workers.ts <companyObjectId>
 *
 * Si no pasas COMPANY_ID, usa la primera empresa que tenga al menos un worker
 * con número "1" y otro con "2" (ceros a la izquierda ignorados).
 *
 * Requiere MONGODB_URI en .env (mismo que el backend).
 */
import fs from "fs";
import path from "path";
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import User from "../src/modules/users/models/user.model";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance_db";

const OUT_DIR = path.join(__dirname, "..", "fixtures");
const OUT_FILE = path.join(OUT_DIR, "excel-planning-real-0001-0002.xlsx");

type Slot = "1" | "2";

function canonicalSlot(raw: string | undefined): Slot | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(/^0+/, "") || "0";
  if (s === "1") return "1";
  if (s === "2") return "2";
  return null;
}

function excelPersonLabel(u: {
  name?: string;
  lastName?: string;
}): string {
  const ln = (u.lastName ?? "").trim();
  const n = (u.name ?? "").trim();
  if (ln && n) return `${ln}, ${n}`;
  return ln || n || "—";
}

function cell(
  time: string,
  vehicle: string,
  emp: string,
  name: string,
  partner?: string,
  partnerEmp?: string,
): string {
  const parts = [time, vehicle, emp, name];
  if (partner) parts.push(partner);
  if (partnerEmp?.trim()) parts.push(partnerEmp.trim());
  return parts.join("\n");
}

async function resolveCompanyId(): Promise<Types.ObjectId> {
  const raw = process.env.COMPANY_ID?.trim() || process.argv[2]?.trim();
  if (raw && Types.ObjectId.isValid(raw)) {
    return new Types.ObjectId(raw);
  }

  const workers = await User.find({
    role: "worker",
    isActive: { $ne: false },
    employeeNumber: { $exists: true, $nin: ["", null] as unknown[] },
    companyId: { $exists: true, $ne: null },
  })
    .select("companyId employeeNumber")
    .lean();

  const byCompany = new Map<string, Set<Slot>>();
  for (const w of workers) {
    const slot = canonicalSlot(w.employeeNumber);
    if (!slot || !w.companyId) continue;
    const cid = String(w.companyId);
    if (!byCompany.has(cid)) byCompany.set(cid, new Set());
    byCompany.get(cid)!.add(slot);
  }

  for (const [cid, slots] of byCompany) {
    if (slots.has("1") && slots.has("2")) {
      console.log(
        `ℹ️  COMPANY_ID no indicado; usando empresa ${cid} (tiene workers 0001 y 0002).`,
      );
      return new Types.ObjectId(cid);
    }
  }

  throw new Error(
    "No se encontró ninguna empresa con dos workers activos 0001 y 0002. " +
      "Pasa COMPANY_ID o el ObjectId como argumento.",
  );
}

async function pickWorkers(companyId: Types.ObjectId): Promise<{
  w1: { employeeNumber: string; label: string };
  w2: { employeeNumber: string; label: string };
}> {
  const list = await User.find({
    companyId,
    role: "worker",
    isActive: { $ne: false },
    employeeNumber: { $exists: true, $nin: ["", null] as unknown[] },
  })
    .select("employeeNumber name lastName")
    .lean();

  let u1: (typeof list)[0] | undefined;
  let u2: (typeof list)[0] | undefined;

  for (const u of list) {
    const slot = canonicalSlot(u.employeeNumber);
    if (slot === "1" && !u1) u1 = u;
    if (slot === "2" && !u2) u2 = u;
  }

  if (!u1 || !u2) {
    throw new Error(
      `En la empresa ${String(companyId)} faltan workers con número 0001 o 0002 (activos).`,
    );
  }

  return {
    w1: {
      employeeNumber: (u1.employeeNumber ?? "0001").trim(),
      label: excelPersonLabel(u1),
    },
    w2: {
      employeeNumber: (u2.employeeNumber ?? "0002").trim(),
      label: excelPersonLabel(u2),
    },
  };
}

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  const companyId = await resolveCompanyId();
  const { w1, w2 } = await pickWorkers(companyId);

  console.log(`   0001 → ${w1.label} (nº hoja: ${w1.employeeNumber})`);
  console.log(`   0002 → ${w2.label} (nº hoja: ${w2.employeeNumber})`);

  const aoa = [
    ["Dienstplan (trabajadores reales 0001 / 0002)", "", "", "", "", "", "", "", ""],
    ["Nr", "Dienstzeit / Wagen", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    [
      "1",
      "Früh",
      cell(
        "06:45-14:45",
        "RTW-11",
        w1.employeeNumber,
        w1.label,
        w2.label,
        w2.employeeNumber,
      ),
      cell(
        "06:45-14:45",
        "RTW-11",
        w2.employeeNumber,
        w2.label,
        w1.label,
        w1.employeeNumber,
      ),
      cell(
        "06:45-14:45",
        "RTW-12",
        w1.employeeNumber,
        w1.label,
        w2.label,
        w2.employeeNumber,
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
        w1.employeeNumber,
        w1.label,
        w2.label,
        w2.employeeNumber,
      ),
      cell(
        "14:30-22:30",
        "RTW-12",
        w2.employeeNumber,
        w2.label,
        w1.label,
        w1.employeeNumber,
      ),
      "",
      "",
      "",
      "",
    ],
  ];

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "Plan");
  XLSX.writeFile(wb, OUT_FILE);

  console.log("✅ Escrito:", OUT_FILE);
  console.log(
    "   Importa en admin Excel planning con la misma plantilla por defecto; weekStart = lunes de la semana del plan.",
  );
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
