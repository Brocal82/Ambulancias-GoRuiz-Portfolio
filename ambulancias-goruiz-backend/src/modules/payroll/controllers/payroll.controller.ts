import { Request, Response } from "express";
import mongoose from "mongoose";
import PayrollDocument from "../models/payroll-document.model";
import User from "../../users/models/user.model";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payroll/upload
// Admin only: upload a payslip PDF for a specific worker.
// ─────────────────────────────────────────────────────────────────────────────
export async function uploadPayrollDocument(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res
        .status(companyResult.statusCode)
        .json({ message: companyResult.message });
      return;
    }
    const adminCompanyId = companyResult.companyId;

    const file = req.file as
      | { filename?: string; path?: string; originalname?: string }
      | undefined;

    if (!file) {
      res.status(400).json({
        message:
          "No se recibió ningún archivo. Usa el campo 'payroll' (PDF).",
      });
      return;
    }

    // Resolve stored filename (same pattern as sick-documents.controller.ts)
    let filename: string | undefined;
    if (file.filename && typeof file.filename === "string") {
      filename = file.filename;
    } else if (file.path && typeof file.path === "string") {
      const normalized = file.path.replace(/\\/g, "/");
      filename = normalized.split("/").pop();
    }

    if (!filename) {
      res
        .status(500)
        .json({ message: "No se pudo resolver el nombre del archivo subido" });
      return;
    }

    const { workerId, year, month } = req.body as {
      workerId?: string;
      year?: string;
      month?: string;
    };

    if (!workerId || !mongoose.Types.ObjectId.isValid(workerId)) {
      res.status(400).json({ message: "workerId es requerido y debe ser válido" });
      return;
    }

    // Validate year/month if provided
    const parsedYear = year !== undefined ? parseInt(year, 10) : undefined;
    const parsedMonth = month !== undefined ? parseInt(month, 10) : undefined;

    if (parsedYear !== undefined && (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100)) {
      res.status(400).json({ message: "year debe ser un número entre 2000 y 2100" });
      return;
    }
    if (parsedMonth !== undefined && (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)) {
      res.status(400).json({ message: "month debe ser un número entre 1 y 12" });
      return;
    }

    // Verify the target worker belongs to the admin's company
    const companyOid = new mongoose.Types.ObjectId(adminCompanyId);
    const workerOid = new mongoose.Types.ObjectId(workerId);

    const workerDoc = await User.findOne({
      _id: workerOid,
      companyId: companyOid,
      role: "worker",
    })
      .select("_id")
      .lean();

    if (!workerDoc) {
      res.status(403).json({
        message:
          "El trabajador no existe o no pertenece a tu empresa",
      });
      return;
    }

    const fileUrl = `/uploads/${filename}`;

    const doc = await PayrollDocument.create({
      workerId: workerOid,
      companyId: companyOid,
      uploadedBy: new mongoose.Types.ObjectId(req.userId as string),
      filename,
      originalName: (req.file as Express.Multer.File).originalname,
      fileUrl,
      ...(parsedYear !== undefined && { year: parsedYear }),
      ...(parsedMonth !== undefined && { month: parsedMonth }),
    });

    res.status(201).json({
      message: "Nómina subida correctamente",
      payrollId: doc._id,
      workerId: doc.workerId,
      filename: doc.filename,
      originalName: doc.originalName,
      year: doc.year,
      month: doc.month,
    });
  } catch (err) {
    console.error("[payroll] uploadPayrollDocument error:", err);
    res.status(500).json({ message: "Error al subir la nómina" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payroll
// Admin only: list all payroll documents scoped to the admin's company.
// ─────────────────────────────────────────────────────────────────────────────
export async function listPayrollDocumentsAdmin(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res
        .status(companyResult.statusCode)
        .json({ message: companyResult.message });
      return;
    }

    const companyOid = new mongoose.Types.ObjectId(companyResult.companyId);

    const docs = await PayrollDocument.find({ companyId: companyOid })
      .sort({ createdAt: -1 })
      .select("-fileUrl")
      .populate("workerId", "firstName lastName email")
      .populate("uploadedBy", "firstName lastName")
      .lean();

    res.status(200).json(docs);
  } catch (err) {
    console.error("[payroll] listPayrollDocumentsAdmin error:", err);
    res.status(500).json({ message: "Error al obtener las nóminas" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payroll/mine
// Worker only: list own payroll documents.
// ─────────────────────────────────────────────────────────────────────────────
export async function listMyPayrollDocuments(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const workerOid = new mongoose.Types.ObjectId(userId);

    const docs = await PayrollDocument.find({ workerId: workerOid })
      .sort({ year: -1, month: -1, createdAt: -1 })
      .select("filename originalName year month createdAt")
      .lean();

    res.status(200).json(docs);
  } catch (err) {
    console.error("[payroll] listMyPayrollDocuments error:", err);
    res.status(500).json({ message: "Error al obtener tus nóminas" });
  }
}
