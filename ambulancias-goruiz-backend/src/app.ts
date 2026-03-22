import express from "express";
import cors from "cors";
import path from "path";
import { env } from "./config/env";

// Rutas
import userRoutes from "./modules/users/routes";
import dienstRoutes from "./modules/diensts/routes";
import hospitalRoutes from "./modules/hospitals/routes";
import { tripsRoutes } from "./modules/trips";
import workdaySummaryRoutes from "./routes/workdaySummaryRoutes";
import praemienRoutes from "./modules/praemien/routes";
import vacationRoutes from "./modules/vacation/routes";
import { ambulancesRoutes } from "./modules/ambulances";
import { messagesRoutes } from "./modules/messages";
import appointmentRoutes from "./routes/appointmentRoutes";
import teamRoutes from "./routes/teamRoutes";
import sickLeaveRoutes from "./modules/sick-leaves/routes";

import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { rateLimitLogin, rateLimitReportIssue } from "./middlewares/rateLimit";

const allowedFromEnv = (env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const FRONTEND_URL = env.FRONTEND_URL?.trim();
if (FRONTEND_URL && !allowedFromEnv.includes(FRONTEND_URL)) {
  allowedFromEnv.push(FRONTEND_URL);
}

const allowedOrigins = new Set(["http://localhost:5173", ...allowedFromEnv]);

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json());

const uploadsDist = path.join(__dirname, "./uploads");
const uploadsRoot = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsDist));
app.use("/uploads", express.static(uploadsRoot));

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

app.use("/api/users/login", rateLimitLogin);
app.use("/api/users", userRoutes);
app.use("/api/diensts", dienstRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/workday-summary/report-issue", rateLimitReportIssue);
app.use("/api/workday-summary", workdaySummaryRoutes);
app.use("/api/praemien", praemienRoutes);
app.use("/api/vacations", vacationRoutes);
app.use("/api/ambulances", ambulancesRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/sick-leaves", sickLeaveRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
