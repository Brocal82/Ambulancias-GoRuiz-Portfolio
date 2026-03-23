import mongoose from "mongoose";
import cron from "node-cron";
import { env } from "./config/env";
import { app } from "./app";
import cleanupOldDiensts from "./utils/cleanupOldDiensts";

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

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
      console.log(`🕒 Cron activo: lunes 00:00 (${TZ})`);
    });
  })
  .catch((err) => {
    console.error("🔴 Error de conexión a MongoDB:", err);
    process.exit(1);
  });
