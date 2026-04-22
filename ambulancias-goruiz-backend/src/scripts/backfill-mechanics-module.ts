/**
 * One-time backfill: add `mechanics` to enabledModules for companies that have
 * `workday` but not `mechanics` (preserves behaviour after issue routes gained
 * requireModule(MECHANICS)).
 *
 *   npx ts-node src/scripts/backfill-mechanics-module.ts
 */

import mongoose from "mongoose";
import { env } from "../config/env";
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";

async function run(): Promise<void> {
  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected");

  const candidates = await Company.find({
    enabledModules: MODULE_KEYS.WORKDAY,
  })
    .select("_id enabledModules")
    .lean();

  let updated = 0;
  for (const c of candidates) {
    const mods = Array.isArray((c as { enabledModules?: string[] }).enabledModules)
      ? (c as { enabledModules: string[] }).enabledModules
      : [];
    if (mods.includes(MODULE_KEYS.MECHANICS)) continue;

    await Company.updateOne(
      { _id: c._id },
      { $addToSet: { enabledModules: MODULE_KEYS.MECHANICS } },
    );
    updated += 1;
  }

  console.log(
    `✅ Backfill mechanics: ${updated} companies updated (${candidates.length} had workday)`,
  );

  await mongoose.disconnect();
  console.log("✅ Disconnected. Done.");
}

run().catch((err: unknown) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
