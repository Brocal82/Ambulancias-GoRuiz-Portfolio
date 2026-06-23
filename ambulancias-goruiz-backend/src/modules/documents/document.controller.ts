import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import {
  requireCompanyForAdmin,
  requireCompanyForWorker,
} from "../../utils/requireCompany";
import { unlinkMulterFiles } from "../../utils/unlinkUploadedFiles";
import { CompanyDocument } from "./models/document.model";
import { DocumentDelivery } from "./models/document-delivery.model";
import User from "../users/models/user.model";
import {
  voidEmitDocumentsChangedToWorkers,
  voidEmitDocumentsChangedToAllCompanyWorkers,
  voidEmitDocumentsChangedToAdmins,
} from "../notifications/utils/ws-notify";

type UploadedFile = {
  originalname?: string;
  filename?: string;
  mimetype?: string;
  path?: string;
} | undefined;

const COMPANY_DOCUMENT_PDF_ONLY_MESSAGE =
  "Solo se permiten archivos PDF para los documentos de empresa.";

function hasPdfExtension(name?: string): boolean {
  if (!name || typeof name !== "string") return false;
  return name.toLowerCase().endsWith(".pdf");
}

function isCompanyDocumentPdfFile(file: {
  mimetype?: string;
  originalname?: string;
  filename?: string;
}): boolean {
  return (
    file.mimetype === "application/pdf" ||
    hasPdfExtension(file.originalname) ||
    hasPdfExtension(file.filename)
  );
}

type FileValidationResult =
  | { ok: true }
  | { ok: false; code: "FILE_INVALID" | "PDF_ONLY" | "MIME_MISMATCH"; message: string };

function validateCompanyDocumentFile(file: UploadedFile): FileValidationResult {
  if (!file || !file.filename || !file.originalname || !file.mimetype) {
    return {
      ok: false,
      code: "FILE_INVALID",
      message: "No se recibió ningún archivo válido",
    };
  }

  const imageMimes = ["image/jpeg", "image/png", "image/webp"];
  if (imageMimes.includes(file.mimetype)) {
    return {
      ok: false,
      code: "PDF_ONLY",
      message: COMPANY_DOCUMENT_PDF_ONLY_MESSAGE,
    };
  }

  if (!isCompanyDocumentPdfFile(file)) {
    return {
      ok: false,
      code: "PDF_ONLY",
      message: COMPANY_DOCUMENT_PDF_ONLY_MESSAGE,
    };
  }

  const hasPdfMime = file.mimetype === "application/pdf";
  const hasPdfExt =
    hasPdfExtension(file.originalname) || hasPdfExtension(file.filename);
  if (hasPdfMime !== hasPdfExt) {
    return {
      ok: false,
      code: "MIME_MISMATCH",
      message:
        "El tipo MIME y la extensión del archivo no coinciden. Solo se permiten PDF.",
    };
  }

  return { ok: true };
}

function getUploadedFilesFromRequest(req: Request): Express.Multer.File[] {
  const single = (req as Request & { file?: Express.Multer.File }).file;
  const multiple = (req as Request & { files?: Express.Multer.File[] }).files;
  if (multiple?.length) return multiple;
  if (single) return [single];
  return [];
}

async function cleanupRequestUploads(req: Request): Promise<void> {
  await unlinkMulterFiles(getUploadedFilesFromRequest(req));
}

async function rollbackCreatedDocuments(
  docIds: mongoose.Types.ObjectId[],
): Promise<void> {
  if (!docIds.length) return;
  await DocumentDelivery.deleteMany({ documentId: { $in: docIds } });
  await CompanyDocument.deleteMany({ _id: { $in: docIds } });
}

/** Multipart / JSON: only explicit truthy strings count; omitted → false. */
function parseRequiresAcknowledgmentFromBody(raw: unknown): boolean {
  if (raw === true) return true;
  if (typeof raw !== "string") return false;
  const s = raw.trim().toLowerCase();
  return s === "true" || s === "1" || s === "on" || s === "yes";
}

/**
 * Stored `false` = informational document (no confirm). Missing field = legacy row
 * (predates flag): keep prior behavior (confirm flow allowed).
 */
function requiresAcknowledgmentForApi(doc: {
  requiresAcknowledgment?: boolean | null;
}): boolean {
  return doc.requiresAcknowledgment !== false;
}

async function createCompanyDocumentWithDeliveries(params: {
  companyId: mongoose.Types.ObjectId;
  adminUserId: mongoose.Types.ObjectId;
  file: UploadedFile;
  targetWorkerId?: mongoose.Types.ObjectId | null;
  workersCache?: { _id: unknown }[];
  uploadBatchId?: mongoose.Types.ObjectId | null;
  requiresAcknowledgment?: boolean;
}) {
  const {
    companyId,
    adminUserId,
    file,
    targetWorkerId,
    workersCache,
    uploadBatchId,
    requiresAcknowledgment,
  } = params;

  if (!file || !file.filename || !file.originalname || !file.mimetype) {
    throw new Error("FILE_INVALID");
  }

  const fileValidation = validateCompanyDocumentFile(file);
  if (!fileValidation.ok) {
    throw new Error(fileValidation.code);
  }

  /** Recipients for DocumentDelivery: all active workers, or exactly one validated target. */
  let recipientWorkers: { _id: unknown }[];

  if (targetWorkerId) {
    const target = await User.findOne({
      _id: targetWorkerId,
      companyId,
      role: "worker",
      isActive: true,
    })
      .select("_id")
      .lean();
    if (!target) {
      throw new Error("TARGET_WORKER_INVALID");
    }
    recipientWorkers = [target];
  } else {
    recipientWorkers =
      workersCache ??
      (await User.find({
        companyId,
        role: "worker",
        isActive: true,
      })
        .select("_id")
        .lean());
  }

  const doc = await CompanyDocument.create({
    companyId,
    uploadedBy: adminUserId,
    targetWorkerId: targetWorkerId ?? null,
    uploadBatchId: uploadBatchId ?? null,
    originalName: file.originalname,
    filename: file.filename,
    mimeType: file.mimetype,
    fileUrl: `/uploads/${file.filename}`,
    requiresAcknowledgment: requiresAcknowledgment === true,
    deletedAt: null,
  });

  if (recipientWorkers.length > 0) {
    const now = new Date();
    const deliveries = recipientWorkers.map((w) => ({
      companyId,
      documentId: doc._id,
      workerId: new mongoose.Types.ObjectId(String(w._id)),
      sentAt: now,
      readAt: null,
    }));
    try {
      await DocumentDelivery.insertMany(deliveries, { ordered: true });
    } catch (insertErr) {
      await CompanyDocument.deleteOne({ _id: doc._id });
      console.error("Error al crear entregas de documento:", insertErr);
      throw new Error("DISTRIBUTION_FAILED");
    }
  }

  return doc;
}

export async function uploadCompanyDocument(req: Request, res: Response) {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const file = (req as Request & { file?: Express.Multer.File }).file as UploadedFile;

  const { targetWorkerId } = (req.body || {}) as { targetWorkerId?: string };
  const requiresAcknowledgment = parseRequiresAcknowledgmentFromBody(
    (req.body as { requiresAcknowledgment?: unknown })?.requiresAcknowledgment,
  );
  let targetWorkerObjectId: mongoose.Types.ObjectId | null = null;

  if (targetWorkerId) {
    if (!mongoose.Types.ObjectId.isValid(targetWorkerId)) {
      await cleanupRequestUploads(req);
      res.status(400).json({ message: "targetWorkerId no es un ObjectId válido" });
      return;
    }
    targetWorkerObjectId = new mongoose.Types.ObjectId(targetWorkerId);
  }

  const fileValidation = validateCompanyDocumentFile(file);
  if (!fileValidation.ok) {
    await cleanupRequestUploads(req);
    res.status(400).json({ message: fileValidation.message });
    return;
  }

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);
    const adminUserId = new mongoose.Types.ObjectId(req.userId as string);

    const doc = await createCompanyDocumentWithDeliveries({
      companyId: companyObjectId,
      adminUserId,
      file,
      targetWorkerId: targetWorkerObjectId,
      requiresAcknowledgment,
    });

    if (targetWorkerObjectId) {
      voidEmitDocumentsChangedToWorkers([String(targetWorkerObjectId)], companyResult.companyId);
    } else {
      voidEmitDocumentsChangedToAllCompanyWorkers(companyResult.companyId);
    }

    res.status(201).json({
      id: doc._id,
      originalName: doc.originalName,
      filename: doc.filename,
      mimeType: doc.mimeType,
      createdAt: doc.createdAt,
      targetWorkerId: doc.targetWorkerId,
      requiresAcknowledgment: requiresAcknowledgmentForApi(doc),
    });
  } catch (err: unknown) {
    await cleanupRequestUploads(req);
    if (err instanceof Error && err.message === "FILE_INVALID") {
      res.status(400).json({ message: "No se recibió ningún archivo válido" });
      return;
    }
    if (
      err instanceof Error &&
      (err.message === "PDF_ONLY" || err.message === "MIME_MISMATCH")
    ) {
      res.status(400).json({ message: COMPANY_DOCUMENT_PDF_ONLY_MESSAGE });
      return;
    }
    if (err instanceof Error && err.message === "TARGET_WORKER_INVALID") {
      res.status(400).json({
        message:
          "El destinatario no es válido: debe ser un trabajador activo de tu empresa.",
      });
      return;
    }
    if (err instanceof Error && err.message === "DISTRIBUTION_FAILED") {
      res.status(500).json({ message: "Error al distribuir el documento" });
      return;
    }
    console.error("Error al guardar documento de empresa:", err);
    res.status(500).json({ message: "Error al guardar el documento" });
  }
}

export async function uploadCompanyDocumentsBatch(req: Request, res: Response) {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const files =
    ((req as Request & { files?: Express.Multer.File[] }).files as
      | UploadedFile[]
      | undefined) ?? [];
  if (!files || files.length === 0) {
    res.status(400).json({ message: "No se recibieron archivos para el lote" });
    return;
  }

  const requiresAcknowledgmentForBatch =
    files.length === 1
      ? parseRequiresAcknowledgmentFromBody(
          (req.body as { requiresAcknowledgment?: unknown })?.requiresAcknowledgment,
        )
      : false;

  if (
    files.length > 1 &&
    parseRequiresAcknowledgmentFromBody(
      (req.body as { requiresAcknowledgment?: unknown })?.requiresAcknowledgment,
    )
  ) {
    await cleanupRequestUploads(req);
    res.status(400).json({
      message:
        "requiresAcknowledgment solo aplica cuando se sube un único archivo.",
    });
    return;
  }

  for (const file of files) {
    const validation = validateCompanyDocumentFile(file);
    if (!validation.ok) {
      await cleanupRequestUploads(req);
      res.status(400).json({ message: validation.message });
      return;
    }
  }

  const createdDocIds: mongoose.Types.ObjectId[] = [];

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);
    const adminUserId = new mongoose.Types.ObjectId(req.userId as string);

    const workers = await User.find({
      companyId: companyObjectId,
      role: "worker",
      isActive: true,
    })
      .select("_id")
      .lean();

    const uploadBatchId = new mongoose.Types.ObjectId();
    const createdDocs = [];
    for (const file of files) {
      const doc = await createCompanyDocumentWithDeliveries({
        companyId: companyObjectId,
        adminUserId,
        file,
        workersCache: workers,
        uploadBatchId,
        requiresAcknowledgment: requiresAcknowledgmentForBatch,
      });
      createdDocIds.push(doc._id as mongoose.Types.ObjectId);
      createdDocs.push({
        id: doc._id,
        originalName: doc.originalName,
        filename: doc.filename,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt,
        requiresAcknowledgment: requiresAcknowledgmentForApi(doc),
      });
    }

    const workerIds = workers.map((w) => String(w._id));
    voidEmitDocumentsChangedToWorkers(workerIds, companyResult.companyId);

    res.status(201).json({
      count: createdDocs.length,
      documents: createdDocs,
    });
  } catch (err: unknown) {
    await rollbackCreatedDocuments(createdDocIds);
    await cleanupRequestUploads(req);
    if (
      err instanceof Error &&
      (err.message === "PDF_ONLY" ||
        err.message === "MIME_MISMATCH" ||
        err.message === "FILE_INVALID")
    ) {
      res.status(400).json({
        message:
          err.message === "FILE_INVALID"
            ? "No se recibió ningún archivo válido"
            : COMPANY_DOCUMENT_PDF_ONLY_MESSAGE,
      });
      return;
    }
    if (err instanceof Error && err.message === "DISTRIBUTION_FAILED") {
      res.status(500).json({ message: "Error al distribuir el lote de documentos" });
      return;
    }
    console.error("Error en subida por lote de documentos de empresa:", err);
    res.status(500).json({ message: "Error al subir el lote de documentos" });
  }
}

export async function listCompanyDocuments(req: Request, res: Response) {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);

    const docs = await CompanyDocument.find({
      companyId: companyObjectId,
      deletedAt: null,
    })
      .select(
        "_id originalName filename mimeType createdAt targetWorkerId uploadBatchId requiresAcknowledgment",
      )
      .sort({ createdAt: -1 })
      .lean();

    const docIds = docs.map((d) => d._id as mongoose.Types.ObjectId);

    let deliveryStats: Record<
      string,
      {
        totalRecipients: number;
        readCount: number;
        acknowledgedCount: number;
        readButNotAcknowledgedCount: number;
      }
    > = {};

    if (docIds.length > 0) {
      const aggregates = await DocumentDelivery.aggregate<{
        _id: mongoose.Types.ObjectId;
        totalRecipients: number;
        readCount: number;
        acknowledgedCount: number;
        readButNotAcknowledgedCount: number;
      }>([
        {
          $match: {
            companyId: companyObjectId,
            documentId: { $in: docIds },
          },
        },
        {
          $group: {
            _id: "$documentId",
            totalRecipients: { $sum: 1 },
            readCount: {
              $sum: {
                $cond: [{ $ne: ["$readAt", null] }, 1, 0],
              },
            },
            acknowledgedCount: {
              $sum: {
                $cond: [
                  { $ne: [{ $ifNull: ["$acknowledgedAt", null] }, null] },
                  1,
                  0,
                ],
              },
            },
            readButNotAcknowledgedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $ifNull: ["$readAt", null] }, null] },
                      { $eq: [{ $ifNull: ["$acknowledgedAt", null] }, null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      deliveryStats = aggregates.reduce(
        (acc, cur) => {
          acc[String(cur._id)] = {
            totalRecipients: cur.totalRecipients,
            readCount: cur.readCount,
            acknowledgedCount: cur.acknowledgedCount,
            readButNotAcknowledgedCount: cur.readButNotAcknowledgedCount,
          };
          return acc;
        },
        {} as Record<
          string,
          {
            totalRecipients: number;
            readCount: number;
            acknowledgedCount: number;
            readButNotAcknowledgedCount: number;
          }
        >,
      );
    }

    res.status(200).json(
      docs.map((d) => {
        const stats = deliveryStats[String(d._id)] ?? {
          totalRecipients: 0,
          readCount: 0,
          acknowledgedCount: 0,
          readButNotAcknowledgedCount: 0,
        };
        const pendingAcknowledgmentCount =
          stats.totalRecipients - stats.acknowledgedCount;
        return {
          id: d._id,
          originalName: d.originalName,
          filename: d.filename,
          mimeType: d.mimeType,
          createdAt: d.createdAt,
          targetWorkerId: d.targetWorkerId ?? null,
          uploadBatchId: d.uploadBatchId ? String(d.uploadBatchId) : null,
          requiresAcknowledgment: requiresAcknowledgmentForApi(
            d as { requiresAcknowledgment?: boolean | null },
          ),
          totalRecipients: stats.totalRecipients,
          readCount: stats.readCount,
          acknowledgedCount: stats.acknowledgedCount,
          pendingAcknowledgmentCount,
          readButNotAcknowledgedCount: stats.readButNotAcknowledgedCount,
        };
      }),
    );
  } catch (err) {
    console.error("Error al listar documentos de empresa:", err);
    res.status(500).json({ message: "Error al obtener los documentos" });
  }
}

export async function deleteCompanyDocument(req: Request, res: Response) {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "ID de documento no válido" });
    return;
  }

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);

    const updated = await CompanyDocument.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        companyId: companyObjectId,
        deletedAt: null,
      },
      { $set: { deletedAt: new Date() } },
      { new: true },
    )
      .select("_id")
      .lean();

    if (!updated) {
      res.status(404).json({ message: "Documento no encontrado" });
      return;
    }

    voidEmitDocumentsChangedToAllCompanyWorkers(companyResult.companyId);

    res.status(200).json({ message: "Documento eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar documento de empresa:", err);
    res.status(500).json({ message: "Error al eliminar el documento" });
  }
}

export async function deleteCompanyDocumentsBatch(req: Request, res: Response) {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { uploadBatchId } = req.params;
  if (!uploadBatchId || !mongoose.Types.ObjectId.isValid(uploadBatchId)) {
    res.status(400).json({ message: "uploadBatchId no es un ObjectId válido" });
    return;
  }

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);
    const batchObjectId = new mongoose.Types.ObjectId(uploadBatchId);

    const result = await CompanyDocument.updateMany(
      {
        companyId: companyObjectId,
        uploadBatchId: batchObjectId,
        deletedAt: null,
      },
      { $set: { deletedAt: new Date() } },
    );

    if (!result.modifiedCount) {
      res.status(404).json({ message: "No se encontraron documentos para ese lote" });
      return;
    }

    voidEmitDocumentsChangedToAllCompanyWorkers(companyResult.companyId);

    res.status(200).json({
      message: "Lote de documentos eliminado correctamente",
      deletedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error al eliminar lote de documentos:", err);
    res.status(500).json({ message: "Error al eliminar el lote de documentos" });
  }
}

// ── Worker: entregas de documentos de empresa (DocumentDelivery como fuente) ─

export async function listMyDocumentDeliveries(req: Request, res: Response) {
  const companyResult = requireCompanyForWorker(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);
    const workerObjectId = new mongoose.Types.ObjectId(req.userId as string);

    const deliveries = await DocumentDelivery.find({
      companyId: companyObjectId,
      workerId: workerObjectId,
    })
      .sort({ sentAt: -1 })
      .lean();

    if (deliveries.length === 0) {
      res.status(200).json({ deliveries: [] });
      return;
    }

    const docIds = [
      ...new Set(deliveries.map((d) => String(d.documentId))),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const docs = await CompanyDocument.find({
      _id: { $in: docIds },
      companyId: companyObjectId,
      deletedAt: null,
    })
      .select("_id originalName filename mimeType createdAt uploadBatchId requiresAcknowledgment")
      .lean();

    const docById = new Map(docs.map((d) => [String(d._id), d]));

    const out: {
      deliveryId: string;
      documentId: string;
      originalName: string;
      filename: string;
      mimeType: string;
      createdAt: Date;
      uploadBatchId: string | null;
      requiresAcknowledgment: boolean;
      sentAt: Date;
      readAt: Date | null;
      acknowledgedAt: Date | null;
    }[] = [];

    for (const d of deliveries) {
      const doc = docById.get(String(d.documentId));
      if (!doc) continue;

      const ack = (d as { acknowledgedAt?: Date | null }).acknowledgedAt;
      out.push({
        deliveryId: String(d._id),
        documentId: String(doc._id),
        originalName: doc.originalName,
        filename: doc.filename,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt,
        uploadBatchId: doc.uploadBatchId ? String(doc.uploadBatchId) : null,
        requiresAcknowledgment: requiresAcknowledgmentForApi(
          doc as { requiresAcknowledgment?: boolean | null },
        ),
        sentAt: d.sentAt,
        readAt: d.readAt ?? null,
        acknowledgedAt: ack ?? null,
      });
    }

    res.status(200).json({ deliveries: out });
  } catch (err) {
    console.error("Error al listar entregas de documentos:", err);
    res.status(500).json({ message: "Error al obtener los documentos" });
  }
}

export async function markMyDocumentDeliveryRead(req: Request, res: Response) {
  const companyResult = requireCompanyForWorker(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { deliveryId } = req.params;
  if (!deliveryId || !mongoose.Types.ObjectId.isValid(deliveryId)) {
    res.status(400).json({ message: "ID de entrega no válido" });
    return;
  }

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);
    const workerObjectId = new mongoose.Types.ObjectId(req.userId as string);
    const deliveryOid = new mongoose.Types.ObjectId(deliveryId);

    const delivery = await DocumentDelivery.findOne({
      _id: deliveryOid,
      companyId: companyObjectId,
      workerId: workerObjectId,
    }).lean();

    if (!delivery) {
      res.status(404).json({ message: "Entrega no encontrada" });
      return;
    }

    const doc = await CompanyDocument.findOne({
      _id: delivery.documentId,
      companyId: companyObjectId,
      deletedAt: null,
    })
      .select("_id")
      .lean();

    if (!doc) {
      res.status(404).json({ message: "Entrega no encontrada" });
      return;
    }

    const now = new Date();
    const updated = await DocumentDelivery.findOneAndUpdate(
      {
        _id: deliveryOid,
        companyId: companyObjectId,
        workerId: workerObjectId,
        readAt: null,
      },
      { $set: { readAt: now } },
      { new: true },
    )
      .select("readAt")
      .lean();

    if (updated?.readAt) {
      voidEmitDocumentsChangedToAdmins(companyResult.companyId);
      res.status(200).json({
        deliveryId: String(deliveryOid),
        readAt: updated.readAt,
      });
      return;
    }

    const final = await DocumentDelivery.findOne({
      _id: deliveryOid,
      companyId: companyObjectId,
      workerId: workerObjectId,
    })
      .select("readAt")
      .lean();

    if (final?.readAt) {
      res.status(200).json({
        deliveryId: String(deliveryOid),
        readAt: final.readAt,
      });
      return;
    }

    res.status(404).json({ message: "Entrega no encontrada" });
  } catch (err) {
    console.error("Error al marcar lectura de entrega:", err);
    res.status(500).json({ message: "Error al actualizar la entrega" });
  }
}

/** Misma cadena que `loginUserService` ante contraseña incorrecta (no filtrar detalles). */
const ACK_PASSWORD_AUTH_FAILURE = "Email o contraseña incorrectos.";

export async function acknowledgeMyDocumentDelivery(req: Request, res: Response) {
  const companyResult = requireCompanyForWorker(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { deliveryId } = req.params;
  if (!deliveryId || !mongoose.Types.ObjectId.isValid(deliveryId)) {
    res.status(400).json({ message: "ID de entrega no válido" });
    return;
  }

  const rawPassword =
    typeof (req.body as { password?: unknown })?.password === "string"
      ? (req.body as { password: string }).password
      : "";
  const password = rawPassword.trim();

  if (!password) {
    res.status(400).json({ message: "Contraseña requerida" });
    return;
  }

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);
    const workerObjectId = new mongoose.Types.ObjectId(req.userId as string);
    const deliveryOid = new mongoose.Types.ObjectId(deliveryId);

    const delivery = await DocumentDelivery.findOne({
      _id: deliveryOid,
      companyId: companyObjectId,
      workerId: workerObjectId,
    }).lean();

    if (!delivery) {
      res.status(404).json({ message: "Entrega no encontrada" });
      return;
    }

    const doc = await CompanyDocument.findOne({
      _id: delivery.documentId,
      companyId: companyObjectId,
      deletedAt: null,
    })
      .select("_id requiresAcknowledgment")
      .lean();

    if (!doc) {
      res.status(404).json({ message: "Entrega no encontrada" });
      return;
    }

    const existingAck = (delivery as { acknowledgedAt?: Date | null }).acknowledgedAt;
    if (existingAck) {
      res.status(200).json({
        deliveryId: String(deliveryOid),
        readAt: delivery.readAt ?? null,
        acknowledgedAt: existingAck,
      });
      return;
    }

    if ((doc as { requiresAcknowledgment?: boolean | null }).requiresAcknowledgment === false) {
      res.status(400).json({
        message: "Este documento no requiere confirmación de recepción.",
      });
      return;
    }

    if (delivery.readAt == null) {
      res.status(409).json({
        message:
          "Debes abrir el documento (marcar como leído) antes de confirmar su recepción.",
      });
      return;
    }

    const user = await User.findOne({
      _id: workerObjectId,
      companyId: companyObjectId,
      isActive: true,
    })
      .select("password")
      .lean();

    if (!user?.password) {
      res.status(401).json({ message: ACK_PASSWORD_AUTH_FAILURE });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: ACK_PASSWORD_AUTH_FAILURE });
      return;
    }

    const now = new Date();
    const updated = await DocumentDelivery.findOneAndUpdate(
      {
        _id: deliveryOid,
        companyId: companyObjectId,
        workerId: workerObjectId,
        acknowledgedAt: null,
      },
      { $set: { acknowledgedAt: now } },
      { new: true },
    )
      .select("readAt acknowledgedAt")
      .lean();

    if (updated?.acknowledgedAt) {
      voidEmitDocumentsChangedToAdmins(companyResult.companyId);
      res.status(200).json({
        deliveryId: String(deliveryOid),
        readAt: updated.readAt ?? null,
        acknowledgedAt: updated.acknowledgedAt,
      });
      return;
    }

    const final = await DocumentDelivery.findOne({
      _id: deliveryOid,
      companyId: companyObjectId,
      workerId: workerObjectId,
    })
      .select("readAt acknowledgedAt")
      .lean();

    const finalAck = (final as { acknowledgedAt?: Date | null })?.acknowledgedAt;
    if (finalAck) {
      res.status(200).json({
        deliveryId: String(deliveryOid),
        readAt: final?.readAt ?? null,
        acknowledgedAt: finalAck,
      });
      return;
    }

    res.status(404).json({ message: "Entrega no encontrada" });
  } catch (err) {
    console.error("Error al confirmar recepción de entrega:", err);
    res.status(500).json({ message: "Error al confirmar la recepción" });
  }
}
