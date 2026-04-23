/**
 * Añade la clave `excel-planning` a empresas que ya tienen `enabledModules`
 * no vacío pero se crearon antes de existir ese módulo.
 *
 * NO modifica empresas con lista vacía o ausente (usar backfill-company-modules).
 * NO quita módulos. Idempotente: empresas que ya tienen la clave no cambian.
 *
 * Cómo ejecutar:
 *   npm run backfill:excel-planning-module
 *   o: npx ts-node src/scripts/backfill-company-module-excel-planning.ts
 */

import mongoose from "mongoose";
import { env } from "../config/env";
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";

const KEY = MODULE_KEYS.EXCEL_PLANNING;

async function run(): Promise<void> {
  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected");

  const filter = {
    "enabledModules.0": { $exists: true },
    enabledModules: { $nin: [KEY] },
  };

  const before = await Company.countDocuments(filter);
  console.log(`ℹ️  Companies with non-empty enabledModules missing "${KEY}": ${before}`);

  const result = await Company.updateMany(filter, {
    $addToSet: { enabledModules: KEY },
  });

  console.log(
    `✅ Updated ${result.modifiedCount} companies (matched ${result.matchedCount})`,
  );

  await mongoose.disconnect();
  console.log("✅ Disconnected. Done.");
}

run().catch((err: unknown) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
