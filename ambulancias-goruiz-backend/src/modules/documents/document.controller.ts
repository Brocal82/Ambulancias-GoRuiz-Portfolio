import type { Request, Response } from "express";
import mongoose from "mongoose";
import { requireCompanyForAdmin } from "../../utils/requireCompany";
import { CompanyDocument } from "./models/document.model";

export async function uploadCompanyDocument(req: Request, res: Response) {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const file = (req as any)?.file as
    | { originalname?: string; filename?: string; mimetype?: string }
    | undefined;

  if (!file || !file.filename || !file.originalname || !file.mimetype) {
    res.status(400).json({ message: "No se recibió ningún archivo válido" });
    return;
  }

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
    const doc = await CompanyDocument.create({
      companyId: new mongoose.Types.ObjectId(companyResult.companyId),
      uploadedBy: new mongoose.Types.ObjectId(req.userId as string),
      targetWorkerId: targetWorkerObjectId,
      originalName: file.originalname,
      filename: file.filename,
      mimeType: file.mimetype,
      fileUrl: `/uploads/${file.filename}`,
      deletedAt: null,
    });

    res.status(201).json({
      id: doc._id,
      originalName: doc.originalName,
      filename: doc.filename,
      mimeType: doc.mimeType,
      createdAt: doc.createdAt,
      targetWorkerId: doc.targetWorkerId,
    });
  } catch (err) {
    console.error("Error al guardar documento de empresa:", err);
    res.status(500).json({ message: "Error al guardar el documento" });
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

    res.status(200).json(
      docs.map((d) => ({
        id: d._id,
        originalName: d.originalName,
        filename: d.filename,
        mimeType: d.mimeType,
        createdAt: d.createdAt,
        targetWorkerId: d.targetWorkerId ?? null,
      })),
    );
  } catch (err) {
    console.error("Error al listar documentos de empresa:", err);
    res.status(500).json({ message: "Error al obtener los documentos" });
  }
}

