import type { Request, Response } from "express";
import mongoose from "mongoose";
import { requireCompanyForAdmin } from "../../utils/requireCompany";
import { CompanyDocument } from "./models/document.model";
import { DocumentDelivery } from "./models/document-delivery.model";
import User from "../users/models/user.model";

type UploadedFile = {
  originalname?: string;
  filename?: string;
  mimetype?: string;
} | undefined;

async function createCompanyDocumentWithDeliveries(params: {
  companyId: mongoose.Types.ObjectId;
  adminUserId: mongoose.Types.ObjectId;
  file: UploadedFile;
  targetWorkerId?: mongoose.Types.ObjectId | null;
  workersCache?: { _id: mongoose.Types.ObjectId }[];
}) {
  const { companyId, adminUserId, file, targetWorkerId, workersCache } = params;

  if (!file || !file.filename || !file.originalname || !file.mimetype) {
    throw new Error("FILE_INVALID");
  }

  const doc = await CompanyDocument.create({
    companyId,
    uploadedBy: adminUserId,
    targetWorkerId: targetWorkerId ?? null,
    originalName: file.originalname,
    filename: file.filename,
    mimeType: file.mimetype,
    fileUrl: `/uploads/${file.filename}`,
    deletedAt: null,
  });

  const workers =
    workersCache ??
    (await User.find({
      companyId,
      role: "worker",
      isActive: true,
    })
      .select("_id")
      .lean());

  if (workers.length > 0) {
    const now = new Date();
    const deliveries = workers.map((w) => ({
      companyId,
      documentId: doc._id,
      workerId: w._id,
      sentAt: now,
      readAt: null,
    }));
    await DocumentDelivery.insertMany(deliveries, { ordered: false }).catch(() => {
      // Ignore duplicate key races; distribution is best-effort per worker.
    });
  }

  return doc;
}

export async function uploadCompanyDocument(req: Request, res: Response) {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const file = (req as any)?.file as UploadedFile;

  const { targetWorkerId } = (req.body || {}) as { targetWorkerId?: string };
  let targetWorkerObjectId: mongoose.Types.ObjectId | null = null;

  if (targetWorkerId) {
    if (!mongoose.Types.ObjectId.isValid(targetWorkerId)) {
      res.status(400).json({ message: "targetWorkerId no es un ObjectId válido" });
      return;
    }
    targetWorkerObjectId = new mongoose.Types.ObjectId(targetWorkerId);
  }

  try {
    const companyObjectId = new mongoose.Types.ObjectId(companyResult.companyId);
    const adminUserId = new mongoose.Types.ObjectId(req.userId as string);

    const doc = await createCompanyDocumentWithDeliveries({
      companyId: companyObjectId,
      adminUserId,
      file,
      targetWorkerId: targetWorkerObjectId,
    });

    res.status(201).json({
      id: doc._id,
      originalName: doc.originalName,
      filename: doc.filename,
      mimeType: doc.mimeType,
      createdAt: doc.createdAt,
      targetWorkerId: doc.targetWorkerId,
    });
  } catch (err: any) {
    if (err instanceof Error && err.message === "FILE_INVALID") {
      res.status(400).json({ message: "No se recibió ningún archivo válido" });
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

  const files = ((req as any)?.files as UploadedFile[] | undefined) ?? [];
  if (!files || files.length === 0) {
    res.status(400).json({ message: "No se recibieron archivos para el lote" });
    return;
  }

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

    const createdDocs = [];
    for (const file of files) {
      const doc = await createCompanyDocumentWithDeliveries({
        companyId: companyObjectId,
        adminUserId,
        file,
        workersCache: workers,
      });
      createdDocs.push({
        id: doc._id,
        originalName: doc.originalName,
        filename: doc.filename,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt,
      });
    }

    res.status(201).json({
      count: createdDocs.length,
      documents: createdDocs,
    });
  } catch (err) {
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
      .select("_id originalName filename mimeType createdAt targetWorkerId")
      .sort({ createdAt: -1 })
      .lean();

    const docIds = docs.map((d) => d._id as mongoose.Types.ObjectId);

    let deliveryStats: Record<
      string,
      { totalRecipients: number; readCount: number }
    > = {};

    if (docIds.length > 0) {
      const aggregates = await DocumentDelivery.aggregate<{
        _id: mongoose.Types.ObjectId;
        totalRecipients: number;
        readCount: number;
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
          },
        },
      ]);

      deliveryStats = aggregates.reduce(
        (acc, cur) => {
          acc[String(cur._id)] = {
            totalRecipients: cur.totalRecipients,
            readCount: cur.readCount,
          };
          return acc;
        },
        {} as Record<string, { totalRecipients: number; readCount: number }>,
      );
    }

    res.status(200).json(
      docs.map((d) => {
        const stats = deliveryStats[String(d._id)] ?? {
          totalRecipients: 0,
          readCount: 0,
        };
        return {
          id: d._id,
          originalName: d.originalName,
          filename: d.filename,
          mimeType: d.mimeType,
          createdAt: d.createdAt,
          targetWorkerId: d.targetWorkerId ?? null,
          totalRecipients: stats.totalRecipients,
          readCount: stats.readCount,
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

    res.status(200).json({ message: "Documento eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar documento de empresa:", err);
    res.status(500).json({ message: "Error al eliminar el documento" });
  }
}

