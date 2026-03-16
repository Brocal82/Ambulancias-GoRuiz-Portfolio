//backend/src/controllers/sickLeaveController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import { z, ZodError } from "zod";
import { DateTime } from "luxon";
import SickLeave from "../models/SickLeave";
import Dienst from "../models/Dienst";
import { clearUserFromDienstsInRange } from "../utils/dienstClearUtils";
import {
  calculateSickDocumentRequirements,
  formatBerlinYmd,
  getAuthUserId,
  toBerlinDay,
  toBerlinEndOfDay,
  toBerlinStartOfDay,
} from "../modules/sick-leaves";

const ZONE = "Europe/Berlin";

// Util para convertir 'YYYY-MM-DD' → Date (inicio/fin del día en TZ Berlin)

// Formatea un Date a 'YYYY-MM-DD' en la zona Europe/Berlin

// ⚠️ Ajusta si tu middleware de auth usa otro campo (req.user.id, req.userId, etc.)

/* ────────────────────────────────────────────────────────────────────────── */
/* Validaciones                                                               */
/* ────────────────────────────────────────────────────────────────────────── */
const createSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // 'YYYY-MM-DD'
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(1000).optional(),
  documentUrl: z.string().url().optional(), // opcional; suele subirse después
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Controladores                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

// Trabajador crea solicitud de baja (queda en 'pending')
export async function createSickLeave(req: Request, res: Response) {
  try {
    const parsed = createSchema.parse(req.body);

    const userId = getAuthUserId(req) || (req.body.user as string | undefined); // fallback por si admin crea a nombre de otro
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: "Usuario no válido" });
      return;
    }

    const start = toBerlinDay(parsed.startDate, false);
    const end = toBerlinDay(parsed.endDate, true);

    if (end < start) {
      res
        .status(400)
        .json({
          message: "El rango de fechas es inválido (endDate < startDate)",
        });
      return;
    }

    const doc = await SickLeave.create({
      user: new mongoose.Types.ObjectId(userId),
      startDate: start,
      endDate: end,
      status: "pending",
      note: parsed.note,
      documentUrl: parsed.documentUrl,
      // ⚠️ Dejamos los campos de documento con sus defaults.
      //    Los ajustaremos al ACEPTAR (Paso 5) según la duración (≥3 días).
    });

    res.status(201).json(doc);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    console.error("❌ createSickLeave error:", err);
    res.status(500).json({ message: "Error al crear la baja" });
  }
}

// Admin lista solicitudes (filtros opcionales: status, user)
export async function listSickLeaves(req: Request, res: Response) {
  try {
    const { status, user } = req.query as { status?: string; user?: string };

    const q: any = {};
    if (status && ["pending", "accepted", "rejected"].includes(status)) {
      q.status = status;
    }
    if (user && mongoose.Types.ObjectId.isValid(user)) {
      q.user = new mongoose.Types.ObjectId(user);
    }

    const items = await SickLeave.find(q)
      .sort({ createdAt: -1 })
      .populate("user", "name lastName email ambulanceRole")
      .lean();

    res.status(200).json(items);
  } catch (err) {
    console.error("❌ listSickLeaves error:", err);
    res.status(500).json({ message: "Error al listar las bajas" });
  }
}

// Trabajador ve SUS solicitudes (filtro opcional por status)
export async function listMySickLeaves(req: Request, res: Response) {
  try {
    const authId = getAuthUserId(req);
    if (!authId || !mongoose.Types.ObjectId.isValid(authId)) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const { status } = req.query as { status?: string };
    const q: any = { user: new mongoose.Types.ObjectId(authId) };
    if (status && ["pending", "accepted", "rejected"].includes(status)) {
      q.status = status;
    }

    const items = await SickLeave.find(q).sort({ createdAt: -1 }).lean();
    res.status(200).json(items);
  } catch (err) {
    console.error("❌ listMySickLeaves error:", err);
    res.status(500).json({ message: "Error al listar tus bajas" });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Aceptar una solicitud de baja:
//  - Marca status=accepted
//  - Calcula requiresDocument/documentDueAt/verificationStatus
//  - Desasigna al usuario de driver/medic en los Diensts del rango (helper compartido)
// ────────────────────────────────────────────────────────────────────────────
export async function acceptSickLeave(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    // 1) Traer la baja
    const sick = await SickLeave.findById(id);
    if (!sick) {
      res.status(404).json({ message: "Baja no encontrada" });
      return;
    }
    if (sick.status === "accepted") {
      res.status(409).json({ message: "La baja ya está aceptada" });
      return;
    }

    // 2) Calcular reglas del documento (≥ 3 días naturales, inclusivo, en TZ Berlin)
    const startDt = toBerlinStartOfDay(sick.startDate);
    const endDt = toBerlinEndOfDay(sick.endDate);

    if (endDt < startDt) {
      res
        .status(400)
        .json({ message: "El rango de fechas de la baja es inválido" });
      return;
    }

    const { requiresDocument, verificationStatus, documentDueAt } =
      calculateSickDocumentRequirements({
        startDate: sick.startDate,
        endDate: sick.endDate,
        createdAt: sick.createdAt,
      });

    // Deadline: 3 días desde la creación de la solicitud (inclusive) en TZ Berlin

    // 3) Marcar aceptada + set de campos de documento
    sick.status = "accepted";
    sick.requiresDocument = requiresDocument;
    sick.verificationStatus = verificationStatus;
    sick.documentDueAt = documentDueAt;
    await sick.save();

    // 4) Limpiar Diensts usando el helper reutilizable
    const userIdStr = String(sick.user);
    const startISO = startDt.toISODate()!; // 'YYYY-MM-DD'
    const endISO = endDt.toISODate()!; // 'YYYY-MM-DD'

    try {
      await clearUserFromDienstsInRange({
        userId: userIdStr,
        startISO,
        endISO,
      });
    } catch (clearErr) {
      console.error(
        "⚠️ Error al desasignar usuario de Diensts tras aceptar baja:",
        clearErr,
      );
      // No rompemos la respuesta al usuario aunque falle la limpieza
    }

    // 5) Respuesta
    res.status(200).json({
      message: "Baja aceptada y desasignación aplicada",
      sickLeaveId: sick._id,
      requiresDocument,
      verificationStatus,
      documentDueAt,
      stats: {
        range: {
          startISO,
          endISO,
        },
      },
    });
  } catch (err) {
    console.error("❌ acceptSickLeave error:", err);
    res.status(500).json({ message: "Error al aceptar la baja" });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Rechazar una solicitud de baja (no desasigna nada)
// ────────────────────────────────────────────────────────────────────────────
export async function rejectSickLeave(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const sick = await SickLeave.findById(id);
    if (!sick) {
      res.status(404).json({ message: "Baja no encontrada" });
      return;
    }

    if (sick.status === "rejected") {
      res.status(409).json({ message: "La baja ya está rechazada" });
      return;
    }

    // Si ya estaba aceptada, por ahora no revertimos desasignaciones
    sick.status = "rejected";
    await sick.save();

    res.status(200).json({
      message: "Baja rechazada",
      sickLeaveId: sick._id,
      status: sick.status,
    });
  } catch (err) {
    console.error("❌ rejectSickLeave error:", err);
    res.status(500).json({ message: "Error al rechazar la baja" });
  }
}

// ────────────────────────────────────────────────────────────────────────────
/**
 * Adjuntar/actualizar Krankschreibung por **URL**
 * - Lo usa el trabajador autenticado (o admin)
 * - Body: { documentUrl: string }
 * - Acumula en documents[] y mantiene documentUrl con el último
 * - Marca verificationStatus = 'received' si antes era 'pending'
 */
// ────────────────────────────────────────────────────────────────────────────
export async function attachSickDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const { documentUrl } = (req.body || {}) as { documentUrl?: string };
    if (!documentUrl || typeof documentUrl !== "string") {
      res.status(400).json({ message: "documentUrl es requerido" });
      return;
    }

    const authId = (req as any)?.user?.id || (req as any)?.userId;
    const isAdmin =
      (req as any)?.user?.role === "admin" || (req as any)?.role === "admin";

    const sick = await SickLeave.findById(id);
    if (!sick) {
      res.status(404).json({ message: "Baja no encontrada" });
      return;
    }

    // Seguridad: si no es admin, debe ser el dueño de la baja
    if (!isAdmin && authId && String(sick.user) !== String(authId)) {
      res
        .status(403)
        .json({ message: "No autorizado para adjuntar documento a esta baja" });
      return;
    }

    // Asegurar array de documentos y acumular URL
    if (!Array.isArray((sick as any).documents)) {
      (sick as any).documents = [];
    }
    (sick as any).documents.push(documentUrl);

    // Mantener compatibilidad: documentUrl = último
    sick.documentUrl = documentUrl;

    // Si requería doc y estaba pendiente -> recibido
    if (sick.requiresDocument && sick.verificationStatus === "pending") {
      sick.verificationStatus = "received";
    }

    await sick.save();

    res.status(200).json({
      message: "Documento (URL) adjuntado correctamente",
      sickLeaveId: sick._id,
      verificationStatus: sick.verificationStatus,
      documentUrl: sick.documentUrl,
      documents: (sick as any).documents,
    });
  } catch (err) {
    console.error("❌ attachSickDocument error:", err);
    res.status(500).json({ message: "Error al adjuntar el documento" });
  }
}

// ────────────────────────────────────────────────────────────────────────────
/**
 * Adjuntar/actualizar Krankschreibung desde ARCHIVO (multipart)
 * - Espera req.file (multer) en el campo 'document'
 * - Normaliza a URL servible por Express: /uploads/<filename> (o file.location en cloud)
 * - Acumula en documents[] y mantiene documentUrl con el último
 * - Marca verificationStatus = 'received' si antes era 'pending'
 * - Devuelve { message, sickLeaveId, verificationStatus, documentUrl, documents }
 */
// ────────────────────────────────────────────────────────────────────────────
export async function attachSickDocumentFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const file = (req as any)?.file as
      | { location?: string; path?: string; filename?: string }
      | undefined;

    if (!file) {
      res
        .status(400)
        .json({
          message: "No se recibió ningún archivo. Usa el campo 'document'.",
        });
      return;
    }

    // Resolver SIEMPRE una URL servible
    let documentUrl: string | undefined;
    if (file.location && typeof file.location === "string") {
      // S3/Cloud
      documentUrl = file.location;
    } else if (file.filename && typeof file.filename === "string") {
      // Disco: servido por /uploads en index.ts
      documentUrl = `/uploads/${file.filename}`;
    } else if (file.path && typeof file.path === "string") {
      // Fallback defensivo
      const normalized = file.path.replace(/\\/g, "/");
      const justName = normalized.split("/").pop()!;
      documentUrl = `/uploads/${justName}`;
    }

    if (!documentUrl) {
      res
        .status(500)
        .json({ message: "No se pudo resolver la URL del archivo subido" });
      return;
    }

    const authId = (req as any)?.user?.id || (req as any)?.userId;
    const isAdmin =
      (req as any)?.user?.role === "admin" || (req as any)?.role === "admin";

    const sick = await SickLeave.findById(id);
    if (!sick) {
      res.status(404).json({ message: "Baja no encontrada" });
      return;
    }

    if (!isAdmin && authId && String(sick.user) !== String(authId)) {
      res
        .status(403)
        .json({ message: "No autorizado para adjuntar documento a esta baja" });
      return;
    }

    // Asegurar array de documentos
    if (!Array.isArray((sick as any).documents)) {
      (sick as any).documents = [];
    }

    // Acumular y mantener compatibilidad
    (sick as any).documents.push(documentUrl.replace(/\\/g, "/"));
    sick.documentUrl = documentUrl.replace(/\\/g, "/");

    // Si requería doc y estaba pendiente -> recibido
    if (sick.requiresDocument && sick.verificationStatus === "pending") {
      sick.verificationStatus = "received";
    }

    await sick.save();

    res.status(200).json({
      message: "Documento (archivo) adjuntado correctamente",
      sickLeaveId: sick._id,
      verificationStatus: sick.verificationStatus,
      documentUrl: sick.documentUrl,
      documents: (sick as any).documents,
    });
  } catch (err) {
    console.error("❌ attachSickDocumentFile error:", err);
    res
      .status(500)
      .json({ message: "Error al adjuntar el documento (archivo)" });
  }
}

/**
 * Devuelve flags de bajas (sick leave) por usuario dentro de un rango.
 * Body:
 *  - userIds: string[]
 *  - fromISO: 'YYYY-MM-DD'
 *  - toISO:   'YYYY-MM-DD'
 *  - includeFullSpan?: boolean (si true, añade sickStartFull/sickUntilFull con el tramo completo de las bajas solapadas)
 *
 * Respuesta:
 *  {
 *    [userId]: {
 *      hasSickInRange: boolean,
 *      sickStartInRange?: 'YYYY-MM-DD',
 *      sickUntilInRange?: 'YYYY-MM-DD',
 *      sickStartFull?: 'YYYY-MM-DD',   // si includeFullSpan
 *      sickUntilFull?: 'YYYY-MM-DD'    // si includeFullSpan
 *    }
 *  }
 */
export async function checkSickInRange(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { userIds, fromISO, toISO, includeFullSpan } = req.body as {
      userIds?: string[];
      fromISO?: string;
      toISO?: string;
      includeFullSpan?: boolean;
    };

    if (!Array.isArray(userIds) || userIds.length === 0 || !fromISO || !toISO) {
      res
        .status(400)
        .json({
          message:
            "Parámetros inválidos. Se requieren userIds[], fromISO y toISO.",
        });
      return;
    }

    // Normalizamos el rango en TZ Berlin (inicio/fin de día) y a JS Date
    const fromStart = DateTime.fromISO(fromISO, { zone: ZONE }).startOf("day");
    const toEnd = DateTime.fromISO(toISO, { zone: ZONE }).endOf("day");
    if (!fromStart.isValid || !toEnd.isValid || toEnd < fromStart) {
      res.status(400).json({ message: "Rango de fechas inválido." });
      return;
    }

    // Solo bajas ACEPTADAS que SOLAPEN con el rango pedido
    const objectIds = userIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (objectIds.length === 0) {
      res.status(400).json({ message: "userIds inválidos." });
      return;
    }

    const rows = await SickLeave.find({
      user: { $in: objectIds },
      status: "accepted",
      startDate: { $lte: toEnd.toJSDate() },
      endDate: { $gte: fromStart.toJSDate() },
    })
      .select("user startDate endDate")
      .lean();

    // Inicializamos el resultado
    const result: Record<
      string,
      {
        hasSickInRange: boolean;
        sickStartInRange?: string;
        sickUntilInRange?: string;
        sickStartFull?: string;
        sickUntilFull?: string;
      }
    > = {};
    for (const id of userIds) {
      result[id] = { hasSickInRange: false };
    }

    // Reducimos por usuario
    const groupByUser = new Map<
      string,
      Array<{ startDate: Date; endDate: Date }>
    >();
    for (const r of rows) {
      const uid = String(r.user);
      if (!groupByUser.has(uid)) groupByUser.set(uid, []);
      groupByUser
        .get(uid)!
        .push({ startDate: r.startDate, endDate: r.endDate });
    }

    for (const uid of userIds) {
      const segments = groupByUser.get(uid);
      if (!segments || segments.length === 0) continue;

      // Para el tramo EN RANGO: tomamos el solapado de cada segmento con [fromStart..toEnd] y unimos (min start, max end)
      let inRangeMin: Date | null = null;
      let inRangeMax: Date | null = null;

      // Para el tramo COMPLETO (opcional): min startDate real, max endDate real de las bajas que solapan
      let fullMin: Date | null = null;
      let fullMax: Date | null = null;

      for (const s of segments) {
        // tramo solapado con el rango pedido
        const overlapStart = new Date(
          Math.max(s.startDate.getTime(), fromStart.toJSDate().getTime()),
        );
        const overlapEnd = new Date(
          Math.min(s.endDate.getTime(), toEnd.toJSDate().getTime()),
        );
        if (overlapStart <= overlapEnd) {
          // Hay solape
          if (!inRangeMin || overlapStart < inRangeMin)
            inRangeMin = overlapStart;
          if (!inRangeMax || overlapEnd > inRangeMax) inRangeMax = overlapEnd;
        }

        if (includeFullSpan) {
          if (!fullMin || s.startDate < fullMin) fullMin = s.startDate;
          if (!fullMax || s.endDate > fullMax) fullMax = s.endDate;
        }
      }

      if (inRangeMin && inRangeMax) {
        result[uid].hasSickInRange = true;
        result[uid].sickStartInRange = formatBerlinYmd(inRangeMin);
        result[uid].sickUntilInRange = formatBerlinYmd(inRangeMax);
      }

      if (includeFullSpan && fullMin && fullMax) {
        result[uid].sickStartFull = formatBerlinYmd(fullMin);
        result[uid].sickUntilFull = formatBerlinYmd(fullMax);
      }
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("❌ checkSickInRange error:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}
