import { Request, Response } from "express";
import mongoose from "mongoose";
import PayrollDocument from "../models/payroll-document.model";
import User from "../../users/models/user.model";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import { matchWorkerFromFilename } from "../utils/payroll-filename-parser";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payroll/upload
// Admin only.
//
// Phase 1 (manual): provide workerId in body → direct assignment, matchStatus "manual".
// Phase 2 (auto):   omit workerId → conservative filename parsing; if exactly
//                   one worker matches → matchStatus "matched"; otherwise the
//                   document is saved with workerId null and matchStatus "unmatched"
//                   for admin review.
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
        message: "No se recibió ningún archivo. Usa el campo 'payroll' (PDF).",
      });
      return;
    }

    // Resolve stored filename (same pattern as sick-documents.controller.ts)
    let storedFilename: string | undefined;
    if (file.filename && typeof file.filename === "string") {
      storedFilename = file.filename;
    } else if (file.path && typeof file.path === "string") {
      const normalized = file.path.replace(/\\/g, "/");
      storedFilename = normalized.split("/").pop();
    }

    if (!storedFilename) {
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

    // Validate year/month if provided
    const parsedYear = year !== undefined ? parseInt(year, 10) : undefined;
    const parsedMonth = month !== undefined ? parseInt(month, 10) : undefined;

    if (
      parsedYear !== undefined &&
      (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100)
    ) {
      res
        .status(400)
        .json({ message: "year debe ser un número entre 2000 y 2100" });
      return;
    }
    if (
      parsedMonth !== undefined &&
      (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)
    ) {
      res
        .status(400)
        .json({ message: "month debe ser un número entre 1 y 12" });
      return;
    }

    const companyOid = new mongoose.Types.ObjectId(adminCompanyId);
    const fileUrl = `/uploads/${storedFilename}`;
    const originalName = (req.file as Express.Multer.File).originalname;

    // ── Manual assignment (Phase 1 path) ─────────────────────────────────────
    if (workerId) {
      if (!mongoose.Types.ObjectId.isValid(workerId)) {
        res
          .status(400)
          .json({ message: "workerId debe ser un ObjectId válido" });
        return;
      }

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
          message: "El trabajador no existe o no pertenece a tu empresa",
        });
        return;
      }

      const doc = await PayrollDocument.create({
        workerId: workerOid,
        companyId: companyOid,
        uploadedBy: new mongoose.Types.ObjectId(req.userId as string),
        filename: storedFilename,
        originalName,
        fileUrl,
        matchStatus: "manual",
        ...(parsedYear !== undefined && { year: parsedYear }),
        ...(parsedMonth !== undefined && { month: parsedMonth }),
      });

      res.status(201).json({
        message: "Nómina subida y asignada manualmente",
        payrollId: doc._id,
        workerId: doc.workerId,
        filename: doc.filename,
        originalName: doc.originalName,
        matchStatus: doc.matchStatus,
        year: doc.year,
        month: doc.month,
      });
      return;
    }

    // ── Auto-match path (Phase 2) ─────────────────────────────────────────────
    const matchResult = await matchWorkerFromFilename(originalName, adminCompanyId);

    if (matchResult.status === "matched") {
      const doc = await PayrollDocument.create({
        workerId: new mongoose.Types.ObjectId(matchResult.workerId),
        companyId: companyOid,
        uploadedBy: new mongoose.Types.ObjectId(req.userId as string),
        filename: storedFilename,
        originalName,
        fileUrl,
        matchStatus: "matched",
        parsedEmployeeNumber: matchResult.parsedEmployeeNumber,
        ...(parsedYear !== undefined && { year: parsedYear }),
        ...(parsedMonth !== undefined && { month: parsedMonth }),
      });

      res.status(201).json({
        message: "Nómina subida y asignada automáticamente",
        payrollId: doc._id,
        workerId: doc.workerId,
        filename: doc.filename,
        originalName: doc.originalName,
        matchStatus: doc.matchStatus,
        parsedEmployeeNumber: doc.parsedEmployeeNumber,
        year: doc.year,
        month: doc.month,
      });
      return;
    }

    // Unmatched — save for admin review, no workerId
    const doc = await PayrollDocument.create({
      workerId: null,
      companyId: companyOid,
      uploadedBy: new mongoose.Types.ObjectId(req.userId as string),
      filename: storedFilename,
      originalName,
      fileUrl,
      matchStatus: "unmatched",
      parsedEmployeeNumber: matchResult.parsedEmployeeNumber ?? undefined,
      matchReason: matchResult.reason,
      ...(parsedYear !== undefined && { year: parsedYear }),
      ...(parsedMonth !== undefined && { month: parsedMonth }),
    });

    res.status(201).json({
      message:
        "Nómina subida pero sin asignar. Revisa y asigna manualmente usando PATCH /api/payroll/:id/assign.",
      payrollId: doc._id,
      filename: doc.filename,
      originalName: doc.originalName,
      matchStatus: doc.matchStatus,
      matchReason: doc.matchReason,
      year: doc.year,
      month: doc.month,
    });
  } catch (err) {
    console.error("[payroll] uploadPayrollDocument error:", err);
    res.status(500).json({ message: "Error al subir la nómina" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/payroll/:id/assign
// Admin only: manually assign (or re-assign) a payroll document to a worker.
// Works on any document in the admin's company regardless of current matchStatus.
// Intended primarily to resolve "unmatched" documents.
// ─────────────────────────────────────────────────────────────────────────────
export async function assignPayrollDocument(
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

    const { id } = req.params;
    const { workerId } = req.body as { workerId?: string };

    if (!workerId || !mongoose.Types.ObjectId.isValid(workerId)) {
      res
        .status(400)
        .json({ message: "workerId es requerido y debe ser un ObjectId válido" });
      return;
    }

    const companyOid = new mongoose.Types.ObjectId(adminCompanyId);
    const workerOid = new mongoose.Types.ObjectId(workerId);

    // Verify the target worker belongs to the admin's company
    const workerDoc = await User.findOne({
      _id: workerOid,
      companyId: companyOid,
      role: "worker",
    })
      .select("_id")
      .lean();

    if (!workerDoc) {
      res.status(403).json({
        message: "El trabajador no existe o no pertenece a tu empresa",
      });
      return;
    }

    // Verify the payroll document belongs to the admin's company
    const payroll = await PayrollDocument.findOne({
      _id: new mongoose.Types.ObjectId(id),
      companyId: companyOid,
    }).select("_id matchStatus");

    if (!payroll) {
      res.status(404).json({ message: "Documento de nómina no encontrado" });
      return;
    }

    payroll.workerId = workerOid;
    payroll.matchStatus = "manual";
    await payroll.save();

    res.status(200).json({
      message: "Nómina asignada correctamente",
      payrollId: payroll._id,
      workerId: payroll.workerId,
      matchStatus: payroll.matchStatus,
    });
  } catch (err) {
    console.error("[payroll] assignPayrollDocument error:", err);
    res.status(500).json({ message: "Error al asignar la nómina" });
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
      .populate("workerId", "name lastName email employeeNumber")
      .populate("uploadedBy", "name lastName")
      .lean();

    // Normalize matchStatus for Phase 1 legacy documents created before Phase 2.
    // .lean() returns raw MongoDB POJOs — Mongoose does NOT inject schema defaults
    // on read for lean queries, so legacy docs missing the field get undefined here.
    const result = docs.map((doc) => ({
      ...doc,
      matchStatus: (doc.matchStatus as string | undefined) ?? "manual",
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("[payroll] listPayrollDocumentsAdmin error:", err);
    res.status(500).json({ message: "Error al obtener las nóminas" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payroll/mine
// Worker only: list own payroll documents.
// Only documents with a confirmed workerId (manual or matched) appear here.
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

    // Only matched/manual docs appear for workers — unmatched (workerId null) are excluded automatically
    const docs = await PayrollDocument.find({ workerId: workerOid })
      .sort({ year: -1, month: -1, createdAt: -1 })
      .select("filename originalName year month matchStatus createdAt")
      .lean();

    // Normalize matchStatus for Phase 1 legacy documents (same reason as admin list).
    const result = docs.map((doc) => ({
      ...doc,
      matchStatus: (doc.matchStatus as string | undefined) ?? "manual",
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("[payroll] listMyPayrollDocuments error:", err);
    res.status(500).json({ message: "Error al obtener tus nóminas" });
  }
}
