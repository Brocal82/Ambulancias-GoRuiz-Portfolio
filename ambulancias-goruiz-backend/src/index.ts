import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import cron from "node-cron";
import { env } from "./config/env";

// Rutas
import userRoutes from "./modules/users/routes";
import dienstRoutes from "./routes/dienstRoutes";
import hospitalRoutes from "./modules/hospitals/routes";
import tripRoutes from "./routes/tripRoutes";
import workdaySummaryRoutes from "./routes/workdaySummaryRoutes";
import praemienRoutes from "./modules/praemien/routes";
import vacationRoutes from "./modules/vacation/routes";
import ambulanceRoutes from "./routes/ambulanceRoutes";
import messageRoutes from "./routes/messageRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import teamRoutes from "./routes/teamRoutes";
import sickLeaveRoutes from "./modules/sick-leaves/routes";

// Utils
import cleanupOldDiensts from "./utils/cleanupOldDiensts";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFoundHandler";

const app = express();

// ----------------------------------------------------------------------------
// Configuración base
// ----------------------------------------------------------------------------
const PORT = env.PORT;
const MONGODB_URI = env.MONGODB_URI;
const TZ = "Europe/Berlin";

// ----------------------------------------------------------------------------
/**
 * CORS: permitir localhost en dev y Netlify en prod sin hardcodear
 * Define una var ALLOWED_ORIGINS="http://localhost:5173,https://tu-app.netlify.app"
 */
const allowedFromEnv = (env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const FRONTEND_URL = env.FRONTEND_URL?.trim();
if (FRONTEND_URL && !allowedFromEnv.includes(FRONTEND_URL)) {
  allowedFromEnv.push(FRONTEND_URL);
}

const allowedOrigins = new Set(["http://localhost:5173", ...allowedFromEnv]);

app.use(
  cors({
    origin(origin, callback) {
      // Requests sin Origin (curl/healthchecks) -> permitir
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// ----------------------------------------------------------------------------
// Middlewares
// ----------------------------------------------------------------------------
app.use(express.json());

// ✅ Servir estáticos de /uploads
// Nota: el middleware de subida guarda en dist/uploads (por __dirname de middlewares).
// Para evitar desajustes, servimos tanto ./uploads (dist) como ../uploads (raíz).
const uploadsDist = path.join(__dirname, "./uploads");
const uploadsRoot = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsDist));
app.use("/uploads", express.static(uploadsRoot));

// Healthcheck simple para Render/monitoreo
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// ----------------------------------------------------------------------------
// Rutas API
// ----------------------------------------------------------------------------
app.use("/api/users", userRoutes);
app.use("/api/diensts", dienstRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/workday-summary", workdaySummaryRoutes);
app.use("/api/praemien", praemienRoutes);
app.use("/api/vacations", vacationRoutes);
app.use("/api/ambulances", ambulanceRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api", notificationRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/sick-leaves", sickLeaveRoutes);

// ----------------------------------------------------------------------------
// 404: rutas no encontradas (antes del errorHandler)
// ----------------------------------------------------------------------------
app.use(notFoundHandler);

// ----------------------------------------------------------------------------
// Middleware global de errores (debe ir después de todas las rutas)
// ----------------------------------------------------------------------------
app.use(errorHandler);

// ----------------------------------------------------------------------------
// Conexión a DB y arranque
// ----------------------------------------------------------------------------
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("🟢 Conectado a MongoDB");

    // No limpiar en el arranque
    // await cleanupOldDiensts();

    // Cron: Lunes 00:00 (Europe/Berlin)
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

    // Render escucha en 0.0.0.0 por defecto; lo ponemos explícito por claridad
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
      console.log(`🕒 Cron activo: lunes 00:00 (${TZ})`);
      console.log(
        `🔓 CORS permitido desde: ${Array.from(allowedOrigins).join(", ")}`,
      );
      console.log(`📂 Sirviendo /uploads desde:`);
      console.log(`   - ${uploadsDist}`);
      console.log(`   - ${uploadsRoot}`);
    });
  })
  .catch((err) => {
    console.error("🔴 Error de conexión a MongoDB:", err);
    process.exit(1);
  });
