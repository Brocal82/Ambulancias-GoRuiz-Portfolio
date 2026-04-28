import mongoose from "mongoose";
import { env } from "../config/env";
import { emitDailySecurityMonitoringReport } from "../security/security-monitoring";

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  try {
    await emitDailySecurityMonitoringReport();
    console.log("[security-monitoring] Daily report emitted.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("[security-monitoring] Failed:", error);
  process.exit(1);
});
