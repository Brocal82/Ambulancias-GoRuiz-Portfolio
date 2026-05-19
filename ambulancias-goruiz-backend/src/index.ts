import http from "http";
import mongoose from "mongoose";
import cron from "node-cron";
import { env } from "./config/env";
import { app } from "./app";
import cleanupOldDiensts from "./utils/cleanupOldDiensts";
import { emitDailySecurityMonitoringReport } from "./security/security-monitoring";
import { buildSecurityMonitoringOperationalHealth } from "./security/security-monitoring-health.service";
import { setupWebSocketServer } from "./modules/notifications";

// Evitar crashes silenciosos: loggear y salir en producción
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] ERROR:", err?.message ?? err);
  console.error("[uncaughtException] Stack:", err instanceof Error ? err.stack : "(no stack)");
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", { reason });
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

const PORT = env.PORT;
const MONGODB_URI = env.MONGODB_URI;
const TZ = "Europe/Berlin";

let server: http.Server | null = null;
let isShuttingDown = false;

function shutdown(): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("Shutting down gracefully...");

  const closeServer = (): Promise<void> =>
    new Promise((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => {
        resolve();
      });
    });

  closeServer()
    .then(() => mongoose.connection.close())
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Shutdown error:", err);
      process.exit(1);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("🟢 Conectado a MongoDB");

    cron.schedule(
      "0 0 * * 1",
      async () => {
        const fired = new Date();
        console.log(
          `[CRON] cleanupOldDiensts START @ ${fired.toISOString()} (server time)`,
        );
        try {
          await cleanupOldDiensts();
          console.log("[CRON] cleanupOldDiensts DONE");
        } catch (err) {
          console.error("[CRON] cleanupOldDiensts ERROR:", err);
        }
      },
      { timezone: TZ },
    );

    if (env.SECURITY_MONITORING_ENABLED) {
      cron.schedule(
        env.SECURITY_MONITORING_CRON,
        async () => {
          const fired = new Date();
          console.log(
            `[CRON] securityMonitoring START @ ${fired.toISOString()} (server time)`,
          );
          try {
            await emitDailySecurityMonitoringReport(fired);
            console.log("[CRON] securityMonitoring DONE");
          } catch (err) {
            console.error("[CRON] securityMonitoring ERROR:", err);
          }
        },
        { timezone: TZ },
      );

      // Dev/restart safety: cron only fires once daily; emit immediately if stale.
      try {
        const health = await buildSecurityMonitoringOperationalHealth();
        if (health.staleDailyReport) {
          console.log("[CRON] securityMonitoring bootstrap START (stale daily report)");
          await emitDailySecurityMonitoringReport(new Date());
          console.log("[CRON] securityMonitoring bootstrap DONE");
        }
      } catch (err) {
        console.error("[CRON] securityMonitoring bootstrap ERROR:", err);
      }
    }

    const httpServer = http.createServer(app);
    server = httpServer;
    setupWebSocketServer(httpServer);

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
      console.log(`🕒 Cron activo: lunes 00:00 (${TZ})`);
      if (env.SECURITY_MONITORING_ENABLED) {
        console.log(
          `🕒 Security monitoring cron activo: ${env.SECURITY_MONITORING_CRON} (${TZ})`,
        );
      }
    });
  })
  .catch((err) => {
    console.error("🔴 Error de conexión a MongoDB:", err);
    process.exit(1);
  });
