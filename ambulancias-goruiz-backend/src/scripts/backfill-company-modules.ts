/**
 * Backfill script: set enabledModules on existing companies that have
 * an empty or absent enabledModules array.
 *
 * WHEN TO RUN:
 *   Run this script ONCE in production before activating requireModule()
 *   on any route (Phase 1). After this script runs, every company has an
 *   explicit module list and the permissive "empty = all allowed" assumption
 *   is no longer needed.
 *
 * SAFETY:
 *   - Only updates companies where enabledModules is absent or empty.
 *   - Companies already configured (array length > 0) are untouched.
 *   - Safe to run multiple times (idempotent).
 *
 * HOW TO RUN:
 *   npx ts-node src/scripts/backfill-company-modules.ts
 *   (or via ts-node-esm depending on project tsconfig)
 */

import mongoose from "mongoose";
import { env } from "../config/env";
import Company from "../modules/companies/models/company.model";
import { V1_DEFAULT_MODULES } from "../modules/companies/constants/modules.constants";

async function run(): Promise<void> {
  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected");

  const result = await Company.updateMany(
    {
      $or: [
        { enabledModules: { $exists: false } },
        { enabledModules: { $size: 0 } },
      ],
    },
    { $set: { enabledModules: V1_DEFAULT_MODULES } },
  );

  console.log(
    `✅ Backfill complete: ${result.modifiedCount} companies updated with V1 default modules`,
  );

  const unchanged = await Company.countDocuments({
    enabledModules: { $exists: true, $not: { $size: 0 } },
  });
  console.log(`ℹ️  ${unchanged} companies already had an explicit module list — left untouched`);

  await mongoose.disconnect();
  console.log("✅ Disconnected. Done.");
}

run().catch((err: unknown) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
