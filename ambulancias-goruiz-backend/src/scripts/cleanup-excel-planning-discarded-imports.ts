/**
 * Elimina en BD importaciones Excel en estado "discarded" antiguas y
 * reintenta borrar el fichero bajo `uploads/` (por si un descarte previo no lo eliminó).
 *
 * Uso: npm run cleanup:excel-planning-discarded
 * Variables: CUTOFF_DAYS (default 30) — filas con updatedAt anterior a ahora - N días.
 */
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { env } from "../config/env";
import ExcelPlanningImport from "../modules/excel-planning/models/excel-planning-import.model";

const uploadDir = path.join(__dirname, "..", "..", "uploads");
const CUTOFF_DAYS = (() => {
  const n = parseInt(process.env.CUTOFF_DAYS ?? "30", 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
})();

function safeUploadFilePath(storedFilename: string): string | null {
  const base = path.basename(storedFilename);
  if (!base || base === "." || base === "..") return null;
  const full = path.resolve(uploadDir, base);
  const root = path.resolve(uploadDir);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

async function run(): Promise<void> {
  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CUTOFF_DAYS);

  const oldDiscarded = await ExcelPlanningImport.find({
    status: "discarded",
    updatedAt: { $lt: cutoff },
  })
    .select("storedFilename")
    .lean<Array<{ _id: mongoose.Types.ObjectId; storedFilename: string }>>();

  console.log(
    `ℹ️  Discarded imports older than ${CUTOFF_DAYS} days (by updatedAt): ${oldDiscarded.length}`,
  );

  let filesRemoved = 0;
  for (const doc of oldDiscarded) {
    const p = safeUploadFilePath(doc.storedFilename);
    if (p) {
      try {
        await fs.unlink(p);
        filesRemoved++;
      } catch {
        // no existe o ya se borró
      }
    }
  }

  const del = await ExcelPlanningImport.deleteMany({
    status: "discarded",
    updatedAt: { $lt: cutoff },
  });

  console.log(
    `✅ Deleted ${del.deletedCount} import documents; attempted to remove ${filesRemoved} existing files (others may be absent)`,
  );

  await mongoose.disconnect();
  console.log("✅ Disconnected. Done.");
}

run().catch((err: unknown) => {
  console.error("❌ cleanup failed:", err);
  process.exit(1);
});
