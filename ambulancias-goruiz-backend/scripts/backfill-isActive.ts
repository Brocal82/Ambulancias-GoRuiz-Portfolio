/**
 * Phase 7a migration: backfill isActive on all existing User documents.
 *
 * MUST be run before deploying any code that filters on `isActive: true`
 * outside of the login path. Without this migration, User documents that
 * pre-date the isActive schema field will not have the field stored in
 * MongoDB. A { isActive: true } filter on such documents returns nothing —
 * login and payroll queries would silently exclude all existing users.
 *
 * This script is safe to run multiple times (idempotent: $set on a field
 * that already has the value is a no-op in MongoDB).
 *
 * Usage:
 *   npx ts-node scripts/backfill-isActive.ts
 *
 * Required env: MONGODB_URI (or falls back to localhost default).
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/modules/users/models/user.model";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance_db";

async function run() {
  console.log("Connecting to MongoDB...");
  try {
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    console.error("Failed to connect:", err);
    process.exit(1);
  }

  console.log("Running isActive backfill...");

  // Set isActive: true on every document that does not already have the field.
  // Using $exists: false to avoid touching documents that were already
  // written with the correct value (e.g. newly created users after schema deploy).
  const result = await User.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true } },
  );

  console.log(
    `Done. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`,
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
