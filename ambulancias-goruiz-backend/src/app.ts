import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { env } from "./config/env";

// Rutas
import userRoutes from "./modules/users/routes";
import dienstRoutes from "./modules/diensts/routes";
import hospitalRoutes from "./modules/hospitals/routes";
import { tripsRoutes } from "./modules/trips";
import { workdaySummaryRoutes } from "./modules/workday-summary";
import praemienRoutes from "./modules/praemien/routes";
import vacationRoutes from "./modules/vacation/routes";
import { ambulancesRoutes } from "./modules/ambulances";
import { messagesRoutes } from "./modules/messages";
import { appointmentsRoutes } from "./modules/appointments";
import { teamsRoutes } from "./modules/teams";
import sickLeaveRoutes from "./modules/sick-leaves/routes";
import invitationsRoutes from "./modules/invitations/routes";
import companiesRoutes from "./modules/companies/routes";

import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { authenticateToken } from "./middlewares/authMiddleware";
import { canAccessFile } from "./utils/fileOwnership";
import {
  rateLimitLogin,
  rateLimitReportIssue,
  rateLimitInvitationAccept,
  rateLimitInvitationValidate,
} from "./middlewares/rateLimit";

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

// Archivos estáticos subidos (perfil, documentos, etc.)
// En producción, conviene servir /uploads desde proxy reverso o CDN para mejor rendimiento y control
const uploadsDist = path.join(__dirname, "./uploads");
const uploadsRoot = path.join(__dirname, "../uploads");

// Phase 2: only allow public access to image files; all other types (e.g. PDF) must go through /api/files/:filename
const ALLOWED_PUBLIC_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const servePublicImages: express.RequestHandler = (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (!ALLOWED_PUBLIC_IMAGE_EXTENSIONS.has(ext)) {
    res.status(403).json({ message: "Acceso no autorizado" });
    return;
  }
  next();
};

app.use("/uploads", servePublicImages, express.static(uploadsDist));
app.use("/uploads", servePublicImages, express.static(uploadsRoot));

app.get("/health", (_req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? "ok" : "down";
  const status = dbState === "ok" ? "ok" : "down";
  res.status(dbState === "ok" ? 200 : 503).json({
    status,
    uptime: process.uptime(),
    db: dbState,
  });
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
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/sick-leaves", sickLeaveRoutes);
app.use("/api/invitations/accept", rateLimitInvitationAccept);
app.use("/api/invitations/validate", rateLimitInvitationValidate);
app.use("/api/invitations", invitationsRoutes);
app.use("/api/companies", companiesRoutes);

app.get("/api/files/:filename", authenticateToken, async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.resolve(uploadsRoot, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: "Archivo no encontrado" });
    return;
  }

  try {
    const allowed = await canAccessFile(
      filename,
      req.userId as string,
      req.userRole as string,
      req.companyId,
    );
    if (!allowed) {
      res.status(403).json({ message: "Acceso no autorizado" });
      return;
    }
  } catch (err) {
    console.error("[fileOwnership] Error al verificar acceso:", err);
    res.status(500).json({ message: "Error interno del servidor" });
    return;
  }

  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ message: "Error al enviar el archivo" });
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
