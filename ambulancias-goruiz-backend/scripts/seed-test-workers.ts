/**
 * Seed 10 test workers for payroll module end-to-end testing.
 *
 * Creates workers with employeeNumbers EMP0001–EMP0010 scoped to a given companyId.
 * After running, the script prints suggested PDF filenames for batch upload testing.
 *
 * Usage:
 *   COMPANY_ID=<mongoObjectId> npx ts-node scripts/seed-test-workers.ts
 *   or: npx ts-node scripts/seed-test-workers.ts <mongoObjectId>
 *
 * Idempotent:
 *   - Workers that already exist (same employeeNumber + companyId) are skipped.
 *   - Workers whose email is already taken are skipped with a warning.
 *   - No existing documents are modified.
 */

import mongoose, { Types } from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../src/modules/users/models/user.model";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance_db";

const WORKER_COUNT = 10;
const DEFAULT_PASSWORD = "TestWorker123!";
const PAYROLL_MONTH = "2025-04";

interface WorkerSeed {
  name: string;
  lastName: string;
  email: string;
  employeeNumber: string;
}

function buildWorkerSeeds(): WorkerSeed[] {
  return Array.from({ length: WORKER_COUNT }, (_, i) => {
    const pad = String(i + 1).padStart(4, "0");
    return {
      name: "Test",
      lastName: `Worker${pad}`,
      email: `test-worker-${pad}@goruiz.test`,
      employeeNumber: `EMP${pad}`,
    };
  });
}

async function seedTestWorkers(): Promise<void> {
  const companyIdRaw = process.env.COMPANY_ID || process.argv[2];

  if (!companyIdRaw) {
    console.error("Error: COMPANY_ID is required.");
    console.error(
      "Usage: COMPANY_ID=<mongoObjectId> npx ts-node scripts/seed-test-workers.ts"
    );
    process.exit(1);
  }

  if (!Types.ObjectId.isValid(companyIdRaw)) {
    console.error(`Error: "${companyIdRaw}" is not a valid MongoDB ObjectId.`);
    process.exit(1);
  }

  const companyId = new Types.ObjectId(companyIdRaw);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("🟢 Connected to MongoDB");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const seeds = buildWorkerSeeds();

  let created = 0;
  let skipped = 0;

  console.log(
    `\n📋 Seeding ${WORKER_COUNT} test workers for companyId: ${companyId}\n`
  );

  for (const seed of seeds) {
    // Idempotency check: same employeeNumber within the same company
    const existsByNumber = await User.findOne({
      employeeNumber: seed.employeeNumber,
      companyId,
    });

    if (existsByNumber) {
      console.log(
        `  ⏭  Skipped  ${seed.employeeNumber}  (already exists: ${existsByNumber.email})`
      );
      skipped++;
      continue;
    }

    // Guard: email must be globally unique (schema enforces it)
    const existsByEmail = await User.findOne({ email: seed.email });
    if (existsByEmail) {
      console.log(
        `  ⚠️  Skipped  ${seed.employeeNumber}  (email ${seed.email} already in use)`
      );
      skipped++;
      continue;
    }

    await User.create({
      name: seed.name,
      lastName: seed.lastName,
      email: seed.email,
      password: hashedPassword,
      role: "worker",
      employeeNumber: seed.employeeNumber,
      companyId,
      isActive: true,
    });

    console.log(
      `  ✅ Created  ${seed.employeeNumber}  →  ${seed.name} ${seed.lastName}  (${seed.email})`
    );
    created++;
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped\n`);

  // ─── Suggested payroll PDF filenames ──────────────────────────────────────
  console.log("─".repeat(60));
  console.log(`📄 Suggested payroll PDF filenames for batch upload (${PAYROLL_MONTH}):`);
  console.log(`   Format: nomina_<EMPLOYEENUMBER>_${PAYROLL_MONTH}.pdf\n`);

  for (const seed of seeds) {
    console.log(`   nomina_${seed.employeeNumber}_${PAYROLL_MONTH}.pdf`);
  }

  console.log();
  console.log("   — Test scenarios —");
  console.log(
    `   UNMATCHED:   nomina_EMP9999_${PAYROLL_MONTH}.pdf  (no worker with EMP9999)`
  );
  console.log(
    `   DUPLICATE:   upload nomina_EMP0001_${PAYROLL_MONTH}.pdf twice  (dedup check)`
  );
  console.log(
    `   COVERAGE GAP: omit nomina_EMP0005_${PAYROLL_MONTH}.pdf  (coverage check)`
  );
  console.log("─".repeat(60));

  await mongoose.disconnect();
  process.exit(0);
}

seedTestWorkers().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
