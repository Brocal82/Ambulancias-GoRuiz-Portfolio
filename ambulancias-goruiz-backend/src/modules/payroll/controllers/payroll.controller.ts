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

      // isActive: true — deactivated workers cannot receive new payroll documents
      // (Phase 7b). Existing historical documents are unaffected.
      const workerDoc = await User.findOne({
        _id: workerOid,
        companyId: companyOid,
        role: "worker",
        isActive: true,
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
// POST /api/payroll/upload/batch
// Admin only. Accepts up to 20 PDF files (field name: "payrolls").
//
// Each file is processed independently using the same auto-match logic as the
// single-file upload. There is no manual workerId path here — unmatched files
// can be reassigned later via PATCH /api/payroll/:id/assign.
//
// Response: 200 with summary counts + per-file result items.
// Partial success is intentional — one file's failure does not abort the rest.
// ─────────────────────────────────────────────────────────────────────────────

type BatchResultItem =
  | {
      originalName: string;
      status: "matched";
      payrollId: string;
      workerId: string;
      matchStatus: "matched";
      parsedEmployeeNumber: string;
      year?: number;
      month?: number;
    }
  | {
      originalName: string;
      status: "unmatched";
      payrollId: string;
      matchStatus: "unmatched";
      matchReason: string;
      year?: number;
      month?: number;
    }
  | {
      originalName: string;
      status: "failed";
      error: string;
    };

export async function uploadPayrollBatch(
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

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({
        message:
          "No se recibieron archivos. Usa el campo 'payrolls' (hasta 20 PDFs).",
      });
      return;
    }

    const { year, month } = req.body as { year?: string; month?: string };

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
    const uploaderOid = new mongoose.Types.ObjectId(req.userId as string);
    const periodFields = {
      ...(parsedYear !== undefined && { year: parsedYear }),
      ...(parsedMonth !== undefined && { month: parsedMonth }),
    };

    const results: BatchResultItem[] = [];
    let matched = 0;
    let unmatched = 0;
    let failed = 0;

    for (const file of files) {
      const originalName = file.originalname;

      // Resolve stored filename — same pattern as uploadPayrollDocument
      let storedFilename: string | undefined;
      if (file.filename && typeof file.filename === "string") {
        storedFilename = file.filename;
      } else if (file.path && typeof file.path === "string") {
        const normalized = file.path.replace(/\\/g, "/");
        storedFilename = normalized.split("/").pop();
      }

      if (!storedFilename) {
        results.push({
          originalName,
          status: "failed",
          error: "No se pudo resolver el nombre del archivo almacenado",
        });
        failed++;
        continue;
      }

      const fileUrl = `/uploads/${storedFilename}`;

      try {
        const matchResult = await matchWorkerFromFilename(
          originalName,
          adminCompanyId,
        );

        if (matchResult.status === "matched") {
          const doc = await PayrollDocument.create({
            workerId: new mongoose.Types.ObjectId(matchResult.workerId),
            companyId: companyOid,
            uploadedBy: uploaderOid,
            filename: storedFilename,
            originalName,
            fileUrl,
            matchStatus: "matched",
            parsedEmployeeNumber: matchResult.parsedEmployeeNumber,
            ...periodFields,
          });

          results.push({
            originalName,
            status: "matched",
            payrollId: String(doc._id),
            workerId: String(doc.workerId),
            matchStatus: "matched",
            parsedEmployeeNumber: matchResult.parsedEmployeeNumber,
            ...periodFields,
          });
          matched++;
        } else {
          const doc = await PayrollDocument.create({
            workerId: null,
            companyId: companyOid,
            uploadedBy: uploaderOid,
            filename: storedFilename,
            originalName,
            fileUrl,
            matchStatus: "unmatched",
            matchReason: matchResult.reason,
            ...periodFields,
          });

          results.push({
            originalName,
            status: "unmatched",
            payrollId: String(doc._id),
            matchStatus: "unmatched",
            matchReason: matchResult.reason,
            ...periodFields,
          });
          unmatched++;
        }
      } catch (fileErr) {
        console.error(
          `[payroll] batch: error processing "${originalName}":`,
          fileErr,
        );
        results.push({
          originalName,
          status: "failed",
          error: "Error interno al procesar este archivo",
        });
        failed++;
      }
    }

    res.status(200).json({
      summary: {
        total: files.length,
        matched,
        unmatched,
        failed,
      },
      results,
    });
  } catch (err) {
    console.error("[payroll] uploadPayrollBatch error:", err);
    res.status(500).json({ message: "Error al procesar el lote de nóminas" });
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

    // Verify the target worker belongs to the admin's company and is active.
    // isActive: true — deactivated workers cannot be assigned new payroll
    // documents (Phase 7b). Historical assignments to deactivated workers
    // remain in the database and are visible in the admin list.
    const workerDoc = await User.findOne({
      _id: workerOid,
      companyId: companyOid,
      role: "worker",
      isActive: true,
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payroll/missing?year=YYYY&month=M
// Admin only (Phase 6).
//
// Returns which workers in the admin's company have no confirmed payroll
// document for the given period.
//
// "Confirmed" = matchStatus "manual" or "matched" with a non-null workerId.
// Unmatched documents (workerId null) are NOT counted as coverage for any
// worker; their count is surfaced separately as `unmatchedDocumentsForPeriod`
// so the admin can correlate with the missing workers list.
//
// This endpoint makes no assumptions about employment lifecycle — there is no
// active/inactive field in the current schema. All workers with
// role "worker" and companyId === admin.companyId are in scope.
// ─────────────────────────────────────────────────────────────────────────────
export async function checkPayrollCoverage(
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

    const { year: yearParam, month: monthParam } = req.query as {
      year?: string;
      month?: string;
    };

    if (!yearParam || !monthParam) {
      res.status(400).json({
        message:
          "Los parámetros 'year' y 'month' son obligatorios. Ejemplo: ?year=2025&month=1",
      });
      return;
    }

    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    if (isNaN(year) || year < 2000 || year > 2100) {
      res
        .status(400)
        .json({ message: "year debe ser un número entre 2000 y 2100" });
      return;
    }
    if (isNaN(month) || month < 1 || month > 12) {
      res
        .status(400)
        .json({ message: "month debe ser un número entre 1 y 12" });
      return;
    }

    const companyOid = new mongoose.Types.ObjectId(adminCompanyId);

    // ── 1. Active workers belonging to this company (Phase 7b) ───────────────
    // isActive: true excludes deactivated workers from the coverage check.
    // "Missing" now means: active worker in the company system with no
    // confirmed payroll document for the period. Deactivated workers are
    // intentionally excluded — their historical documents remain intact.
    const workers = (await User.find({
      companyId: companyOid,
      role: "worker",
      isActive: true,
    })
      .select("_id name lastName email employeeNumber")
      .lean()) as Array<{
      _id: unknown;
      name: string;
      lastName: string;
      email: string;
      employeeNumber?: string;
    }>;

    // ── 2. Confirmed payroll documents for the exact period ───────────────────
    // "Confirmed" = manual or matched, always has a non-null workerId.
    const coveredDocs = (await PayrollDocument.find({
      companyId: companyOid,
      year,
      month,
      matchStatus: { $in: ["manual", "matched"] },
      workerId: { $ne: null },
    })
      .select("workerId")
      .lean()) as Array<{ workerId: unknown }>;

    // Build a Set of workerIds that already have coverage — O(1) lookup.
    const coveredWorkerIdSet = new Set(
      coveredDocs.map((doc) => String(doc.workerId)),
    );

    // ── 3. Workers with no confirmed document for this period ─────────────────
    const missingWorkers = workers.filter(
      (w) => !coveredWorkerIdSet.has(String(w._id)),
    );

    // ── 4. Unmatched documents for this period (not assigned to any worker) ───
    // Surfaced separately so the admin can correlate: if missingCount > 0 and
    // unmatchedDocumentsForPeriod > 0, some workers may be covered once those
    // unmatched documents are assigned.
    const unmatchedDocumentsForPeriod = await PayrollDocument.countDocuments({
      companyId: companyOid,
      year,
      month,
      matchStatus: "unmatched",
    });

    // coveredCount derived from workers in scope (not from Set size) so that
    // totalWorkers === coveredCount + missingCount is always an exact identity.
    const coveredCount = workers.length - missingWorkers.length;

    res.status(200).json({
      period: { year, month },
      totalWorkers: workers.length,
      coveredCount,
      missingCount: missingWorkers.length,
      missingWorkers: missingWorkers.map((w) => ({
        _id: w._id,
        name: w.name,
        lastName: w.lastName,
        email: w.email,
        employeeNumber: w.employeeNumber ?? null,
      })),
      unmatchedDocumentsForPeriod,
    });
  } catch (err) {
    console.error("[payroll] checkPayrollCoverage error:", err);
    res
      .status(500)
      .json({ message: "Error al verificar la cobertura de nóminas" });
  }
}
