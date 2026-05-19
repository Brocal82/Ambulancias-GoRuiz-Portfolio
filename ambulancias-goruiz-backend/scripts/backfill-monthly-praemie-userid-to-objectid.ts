/**
 * Migration: convert MonthlyPraemie.userId from String to ObjectId.
 *
 * Background: the original schema stored userId as a plain String. All other
 * models that reference a User use ObjectId. This inconsistency prevents
 * Mongoose populate() from working and makes cross-collection joins unreliable.
 *
 * What this script does:
 *   1. Finds all MonthlyPraemie documents whose userId is stored as a BSON
 *      String (not ObjectId) in MongoDB.
 *   2. For each document, converts the String value to ObjectId and saves it.
 *   3. Reports how many documents were migrated.
 *
 * Safety:
 *   - Idempotent: documents already stored with ObjectId BSON type are skipped.
 *   - Uses the raw MongoDB collection driver to bypass Mongoose casting and
 *     inspect the actual stored BSON type.
 *   - Dry-run mode: set DRY_RUN=true to preview without writing.
 *
 * Prerequisites:
 *   - Deploy the updated monthly-praemie.model.ts (userId: ObjectId) first.
 *   - MUST be run before the praemien module is used in production.
 *
 * Usage:
 *   npx ts-node scripts/backfill-monthly-praemie-userid-to-objectid.ts
 *   DRY_RUN=true npx ts-node scripts/backfill-monthly-praemie-userid-to-objectid.ts
 *
 * Required env: MONGODB_URI (or falls back to localhost default).
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const DRY_RUN = process.env.DRY_RUN === "true";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance_db";

async function run() {
  console.log(`[backfill] Connecting to MongoDB... (dry_run=${DRY_RUN})`);
  try {
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    console.error("[backfill] Failed to connect:", err);
    process.exit(1);
  }

  const collection = mongoose.connection.collection("monthlypraemies");

  // Find documents where userId is stored as a String BSON type (type code 2)
  // $type: 2 is the BSON string type; $type: 7 is ObjectId.
  const cursor = collection.find({ userId: { $type: "string" } });

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for await (const doc of cursor) {
    const rawUserId = doc.userId as string;

    if (!mongoose.Types.ObjectId.isValid(rawUserId)) {
      console.warn(
        `[backfill] Skipping doc ${doc._id}: userId "${rawUserId}" is not a valid ObjectId string`,
      );
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[backfill] [DRY RUN] Would convert doc ${doc._id}: "${rawUserId}" → ObjectId`,
      );
      migrated++;
      continue;
    }

    try {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { userId: new mongoose.Types.ObjectId(rawUserId) } },
      );
      migrated++;
    } catch (err) {
      console.error(`[backfill] Error updating doc ${doc._id}:`, err);
      errors++;
    }
  }

  console.log(
    `[backfill] Done. Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`,
  );

  if (errors > 0) {
    console.error("[backfill] Some documents failed — review errors above.");
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill] Unexpected error:", err);
  process.exit(1);
});
