import { Request, Response } from "express";
import fs from "fs";
import mongoose from "mongoose";
import PayrollDocument from "../models/payroll-document.model";
import User from "../../users/models/user.model";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import { validateSecureUploadFilename } from "../../../utils/secureUploadFilename";
import { matchWorkerFromFilename } from "../utils/payroll-filename-parser";
import { sendPushNotification } from "../../notifications";

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate detection helper (Phase 8a)
//
// Returns minimal metadata for the first confirmed (manual/matched) document
// that shares the same worker + period inside this company, excluding the
// document just created/saved.
// Returns null when no duplicate is found or when year/month is absent
// (cannot detect duplicates without a complete period).
// ─────────────────────────────────────────────────────────────────────────────
interface DuplicateInfo {
  payrollId: string;
  originalName: string;
  createdAt: Date;
}

interface ReplacementInfo {
  payrollId: string;
  originalName: string;
}

type UploadedFileLike = {
  mimetype?: string;
  originalname?: string;
  filename?: string;
  path?: string;
};

const PAYROLL_PDF_ONLY_MESSAGE =
  "Solo se permiten archivos PDF para las nóminas.";
const PAYROLL_MIME_MISMATCH_MESSAGE =
  "El tipo MIME y la extensión del archivo no coinciden. Solo se permiten PDF.";

function hasPdfExtension(name?: string): boolean {
  if (!name || typeof name !== "string") return false;
  return name.toLowerCase().endsWith(".pdf");
}

type PayrollFileValidationResult =
  | { ok: true }
  | { ok: false; message: string };

function validatePayrollFile(file: UploadedFileLike): PayrollFileValidationResult {
  const imageMimes = ["image/jpeg", "image/png", "image/webp"];
  if (file.mimetype && imageMimes.includes(file.mimetype)) {
    return { ok: false, message: PAYROLL_PDF_ONLY_MESSAGE };
  }

  if (!isPayrollPdfFile(file)) {
    return { ok: false, message: PAYROLL_PDF_ONLY_MESSAGE };
  }

  const hasPdfMime = file.mimetype === "application/pdf";
  const hasPdfExt =
    hasPdfExtension(file.originalname) || hasPdfExtension(file.filename);
  if (hasPdfMime !== hasPdfExt) {
    return { ok: false, message: PAYROLL_MIME_MISMATCH_MESSAGE };
  }

  return { ok: true };
}

function isPayrollPdfFile(file: UploadedFileLike): boolean {
  // Accept PDF by MIME, with extension fallback for clients that send generic MIME.
  return (
    file.mimetype === "application/pdf" ||
    hasPdfExtension(file.originalname) ||
    hasPdfExtension(file.filename)
  );
}

function resolveStoredPayrollFilename(
  file: UploadedFileLike,
): string | undefined {
  let storedFilename: string | undefined;
  if (file.filename && typeof file.filename === "string") {
    storedFilename = file.filename;
  } else if (file.path && typeof file.path === "string") {
    const normalized = file.path.replace(/\\/g, "/");
    storedFilename = normalized.split("/").pop();
  }

  if (!storedFilename) return undefined;

  const secure = validateSecureUploadFilename(storedFilename);
  if (!secure.ok) return undefined;

  return secure.filename;
}

async function rollbackCreatedPayrollDocument(
  documentId: mongoose.Types.ObjectId,
  file: UploadedFileLike,
): Promise<void> {
  await PayrollDocument.deleteOne({ _id: documentId }).catch(() => undefined);
  await deleteUploadedFileIfPresent(file);
}

async function finalizeConfirmedPayrollUpload(params: {
  companyOid: mongoose.Types.ObjectId;
  workerOid: mongoose.Types.ObjectId;
  year: number;
  month: number;
  newDocumentId: mongoose.Types.ObjectId;
  file: UploadedFileLike;
}): Promise<{
  replacedDocument: ReplacementInfo | null;
  possibleDuplicate: DuplicateInfo | null;
}> {
  const { companyOid, workerOid, year, month, newDocumentId, file } = params;

  try {
    const replacedDocument = await replaceExistingConfirmedPayroll({
      companyOid,
      workerOid,
      year,
      month,
      newDocumentId,
    });

    const possibleDuplicate = await findPayrollDuplicate(
      companyOid,
      workerOid,
      year,
      month,
      newDocumentId,
    );

    return { replacedDocument, possibleDuplicate };
  } catch (err) {
    await rollbackCreatedPayrollDocument(newDocumentId, file);
    throw err;
  }
}

async function deleteUploadedFileIfPresent(file: UploadedFileLike): Promise<void> {
  if (!file.path || typeof file.path !== "string") return;
  await fs.promises.unlink(file.path).catch(() => undefined);
}

async function deleteUploadedFilesIfPresent(
  files: UploadedFileLike[],
): Promise<void> {
  await Promise.all(files.map((file) => deleteUploadedFileIfPresent(file)));
}

async function findPayrollDuplicate(
  companyOid: mongoose.Types.ObjectId,
  workerOid: mongoose.Types.ObjectId,
  year: number | undefined,
  month: number | undefined,
  excludeDocumentId: mongoose.Types.ObjectId,
): Promise<DuplicateInfo | null> {
  if (year === undefined || month === undefined) return null;

  const existing = await PayrollDocument.findOne({
    _id: { $ne: excludeDocumentId },
    companyId: companyOid,
    workerId: workerOid,
    year,
    month,
    matchStatus: { $in: ["manual", "matched"] },
    deletedAt: null,
  })
    .select("originalName createdAt")
    .lean();

  if (!existing) return null;

  return {
    payrollId: String(existing._id),
    originalName: existing.originalName,
    createdAt: existing.createdAt as Date,
  };
}

async function replaceExistingConfirmedPayroll(params: {
  companyOid: mongoose.Types.ObjectId;
  workerOid: mongoose.Types.ObjectId;
  year: number;
  month: number;
  newDocumentId: mongoose.Types.ObjectId;
}): Promise<ReplacementInfo | null> {
  const { companyOid, workerOid, year, month, newDocumentId } = params;

  const existingDuplicates = await PayrollDocument.find({
    _id: { $ne: newDocumentId },
    companyId: companyOid,
    workerId: workerOid,
    year,
    month,
    matchStatus: { $in: ["manual", "matched"] },
    deletedAt: null,
  })
    .select("_id originalName")
    .sort({ createdAt: -1 })
    .lean();

  if (existingDuplicates.length === 0) return null;

  const duplicateIds = existingDuplicates.map((d) => d._id);
  await PayrollDocument.updateMany(
    { _id: { $in: duplicateIds } },
    { $set: { deletedAt: new Date() } },
  );
  const mostRecentReplaced = existingDuplicates[0];

  return {
    payrollId: String(mostRecentReplaced._id),
    originalName: mostRecentReplaced.originalName,
  };
}

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
  const uploadedFile = req.file as UploadedFileLike | undefined;
  let documentCreated = false;

  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      await deleteUploadedFileIfPresent(uploadedFile ?? {});
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

    if (!isPayrollPdfFile(file)) {
      await deleteUploadedFileIfPresent(file);
      res.status(400).json({ message: PAYROLL_PDF_ONLY_MESSAGE });
      return;
    }

    const fileValidation = validatePayrollFile(file);
    if (!fileValidation.ok) {
      await deleteUploadedFileIfPresent(file);
      res.status(400).json({ message: fileValidation.message });
      return;
    }

    const storedFilename = resolveStoredPayrollFilename(file);

    if (!storedFilename) {
      await deleteUploadedFileIfPresent(file);
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

    if (year === undefined || String(year).trim() === "") {
      await deleteUploadedFileIfPresent(file);
      res.status(400).json({ message: "year es obligatorio" });
      return;
    }
    if (month === undefined || String(month).trim() === "") {
      await deleteUploadedFileIfPresent(file);
      res.status(400).json({ message: "month es obligatorio" });
      return;
    }

    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      await deleteUploadedFileIfPresent(file);
      res
        .status(400)
        .json({ message: "year debe ser un número entre 2000 y 2100" });
      return;
    }
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      await deleteUploadedFileIfPresent(file);
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
        await deleteUploadedFileIfPresent(file);
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
        await deleteUploadedFileIfPresent(file);
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
        year: parsedYear,
        month: parsedMonth,
      });
      documentCreated = true;

      void sendPushNotification(
        [workerOid.toString()],
        "Nómina disponible",
        parsedYear && parsedMonth
          ? `Tu nómina de ${parsedMonth}/${parsedYear} está disponible.`
          : "Tienes una nueva nómina disponible.",
        { screen: "documents" },
      );

      const { replacedDocument, possibleDuplicate } =
        await finalizeConfirmedPayrollUpload({
          companyOid,
          workerOid,
          year: parsedYear,
          month: parsedMonth,
          newDocumentId: new mongoose.Types.ObjectId(String(doc._id)),
          file,
        });

      res.status(201).json({
        message: replacedDocument
          ? "Nómina subida y reemplazo aplicado sobre la nómina activa anterior"
          : "Nómina subida y asignada manualmente",
        status: "uploaded",
        payrollId: doc._id,
        workerId: doc.workerId,
        filename: doc.filename,
        originalName: doc.originalName,
        matchStatus: doc.matchStatus,
        year: doc.year,
        month: doc.month,
        ...(replacedDocument && { replacedDocument }),
        ...(possibleDuplicate && { possibleDuplicate }),
      });
      return;
    }

    // ── Auto-match path (Phase 2) ─────────────────────────────────────────────
    const matchResult = await matchWorkerFromFilename(originalName, adminCompanyId);

    if (matchResult.status === "matched") {
      const matchedWorkerOid = new mongoose.Types.ObjectId(matchResult.workerId);
      const doc = await PayrollDocument.create({
        workerId: matchedWorkerOid,
        companyId: companyOid,
        uploadedBy: new mongoose.Types.ObjectId(req.userId as string),
        filename: storedFilename,
        originalName,
        fileUrl,
        matchStatus: "matched",
        parsedEmployeeNumber: matchResult.parsedEmployeeNumber,
        year: parsedYear,
        month: parsedMonth,
      });
      documentCreated = true;

      void sendPushNotification(
        [matchedWorkerOid.toString()],
        "Nómina disponible",
        parsedYear && parsedMonth
          ? `Tu nómina de ${parsedMonth}/${parsedYear} está disponible.`
          : "Tienes una nueva nómina disponible.",
        { screen: "documents" },
      );

      const { replacedDocument, possibleDuplicate } =
        await finalizeConfirmedPayrollUpload({
          companyOid,
          workerOid: matchedWorkerOid,
          year: parsedYear,
          month: parsedMonth,
          newDocumentId: new mongoose.Types.ObjectId(String(doc._id)),
          file,
        });

      res.status(201).json({
        message: replacedDocument
          ? "Nómina subida automáticamente y reemplazo aplicado sobre la nómina activa anterior"
          : "Nómina subida y asignada automáticamente",
        status: "uploaded",
        payrollId: doc._id,
        workerId: doc.workerId,
        filename: doc.filename,
        originalName: doc.originalName,
        matchStatus: doc.matchStatus,
        parsedEmployeeNumber: doc.parsedEmployeeNumber,
        year: doc.year,
        month: doc.month,
        ...(replacedDocument && { replacedDocument }),
        ...(possibleDuplicate && { possibleDuplicate }),
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
      year: parsedYear,
      month: parsedMonth,
    });
    documentCreated = true;

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
    if (!documentCreated) {
      await deleteUploadedFileIfPresent(uploadedFile ?? {});
    }
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
      possibleDuplicate?: DuplicateInfo;
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
    }
  | {
      originalName: string;
      status: "matched";
      payrollId: string;
      workerId: string;
      matchStatus: "matched";
      parsedEmployeeNumber: string;
      replacedDocument: ReplacementInfo;
      year?: number;
      month?: number;
    };

export async function uploadPayrollBatch(
  req: Request,
  res: Response,
): Promise<void> {
  const uploadedFiles = (req.files as UploadedFileLike[] | undefined) ?? [];

  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      await deleteUploadedFilesIfPresent(uploadedFiles);
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

    const invalidFiles = files.filter((file) => {
      const validation = validatePayrollFile(file);
      return !validation.ok;
    });
    if (invalidFiles.length > 0) {
      // Batch is all-or-nothing for file-type validation to avoid mixed behavior.
      await deleteUploadedFilesIfPresent(files);
      const firstInvalid = validatePayrollFile(invalidFiles[0]);
      res.status(400).json({
        message: firstInvalid.ok ? PAYROLL_PDF_ONLY_MESSAGE : firstInvalid.message,
      });
      return;
    }

    const { year, month } = req.body as { year?: string; month?: string };

    if (year === undefined || String(year).trim() === "") {
      await deleteUploadedFilesIfPresent(files);
      res.status(400).json({ message: "year es obligatorio" });
      return;
    }
    if (month === undefined || String(month).trim() === "") {
      await deleteUploadedFilesIfPresent(files);
      res.status(400).json({ message: "month es obligatorio" });
      return;
    }

    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      await deleteUploadedFilesIfPresent(files);
      res
        .status(400)
        .json({ message: "year debe ser un número entre 2000 y 2100" });
      return;
    }
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      await deleteUploadedFilesIfPresent(files);
      res
        .status(400)
        .json({ message: "month debe ser un número entre 1 y 12" });
      return;
    }

    const companyOid = new mongoose.Types.ObjectId(adminCompanyId);
    const uploaderOid = new mongoose.Types.ObjectId(req.userId as string);
    const periodFields = {
      year: parsedYear,
      month: parsedMonth,
    };

    const results: BatchResultItem[] = [];
    let matched = 0;
    let unmatched = 0;
    let failed = 0;
    let duplicateWarnings = 0;

    for (const file of files) {
      const originalName = file.originalname;
      let documentCreatedForFile = false;

      // Resolve stored filename — validated for /api/files compatibility
      const storedFilename = resolveStoredPayrollFilename(file);

      if (!storedFilename) {
        await deleteUploadedFileIfPresent(file);
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
          const batchWorkerOid = new mongoose.Types.ObjectId(matchResult.workerId);
          const doc = await PayrollDocument.create({
            workerId: batchWorkerOid,
            companyId: companyOid,
            uploadedBy: uploaderOid,
            filename: storedFilename,
            originalName,
            fileUrl,
            matchStatus: "matched",
            parsedEmployeeNumber: matchResult.parsedEmployeeNumber,
            ...periodFields,
          });
          documentCreatedForFile = true;

          const { replacedDocument, possibleDuplicate } =
            await finalizeConfirmedPayrollUpload({
              companyOid,
              workerOid: batchWorkerOid,
              year: parsedYear,
              month: parsedMonth,
              newDocumentId: new mongoose.Types.ObjectId(String(doc._id)),
              file,
            });
          if (replacedDocument) duplicateWarnings++;
          if (possibleDuplicate) duplicateWarnings++;

          results.push({
            originalName,
            status: "matched",
            payrollId: String(doc._id),
            workerId: String(doc.workerId),
            matchStatus: "matched",
            parsedEmployeeNumber: matchResult.parsedEmployeeNumber,
            ...periodFields,
            ...(replacedDocument && { replacedDocument }),
            ...(possibleDuplicate && { possibleDuplicate }),
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
          documentCreatedForFile = true;

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
        if (!documentCreatedForFile) {
          await deleteUploadedFileIfPresent(file);
        }
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
        duplicateWarnings,
      },
      results,
    });
  } catch (err) {
    await deleteUploadedFilesIfPresent(uploadedFiles);
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

    // Verify the payroll document belongs to the admin's company and is not invalidated.
    // year + month are selected so the duplicate check can use them.
    const payroll = await PayrollDocument.findOne({
      _id: new mongoose.Types.ObjectId(id),
      companyId: companyOid,
      deletedAt: null,
    }).select("_id matchStatus year month");

    if (!payroll) {
      res.status(404).json({ message: "Documento de nómina no encontrado" });
      return;
    }

    payroll.workerId = workerOid;
    payroll.matchStatus = "manual";
    await payroll.save();

    void sendPushNotification(
      [workerId],
      "Nómina disponible",
      payroll.year && payroll.month
        ? `Tu nómina de ${payroll.month}/${payroll.year} está disponible.`
        : "Tienes una nueva nómina disponible.",
      { screen: "documents" },
    );

    const possibleDuplicate = await findPayrollDuplicate(
      companyOid,
      workerOid,
      payroll.year,
      payroll.month,
      new mongoose.Types.ObjectId(String(payroll._id)),
    );

    res.status(200).json({
      message: "Nómina asignada correctamente",
      payrollId: payroll._id,
      workerId: payroll.workerId,
      matchStatus: payroll.matchStatus,
      ...(possibleDuplicate && { possibleDuplicate }),
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

    const docs = await PayrollDocument.find({ companyId: companyOid, deletedAt: null })
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

    const query: {
      workerId: mongoose.Types.ObjectId;
      deletedAt: null;
      companyId?: mongoose.Types.ObjectId;
    } = { workerId: workerOid, deletedAt: null };

    // Defense-in-depth: when the JWT carries companyId, scope to current company.
    const userCompanyId = req.companyId;
    if (userCompanyId && mongoose.Types.ObjectId.isValid(userCompanyId)) {
      query.companyId = new mongoose.Types.ObjectId(userCompanyId);
    }

    // Only matched/manual docs appear for workers — unmatched (workerId null) are excluded automatically.
    // Invalidated documents are also excluded.
    const docs = await PayrollDocument.find(query)
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
      deletedAt: null,
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
      deletedAt: null,
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payroll/coverage/year?year=YYYY
// Admin only.
//
// Returns compact monthly counters for the year grid:
// - totalWorkers: active workers in the company
// - months: assigned payroll document count per month (1..12),
//           where assigned means matchStatus manual/matched with workerId.
// ─────────────────────────────────────────────────────────────────────────────
export async function getPayrollCoverageYearSummary(
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

    const { year: yearParam } = req.query as { year?: string };
    if (!yearParam) {
      res.status(400).json({
        message: "El parámetro 'year' es obligatorio. Ejemplo: ?year=2025",
      });
      return;
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      res
        .status(400)
        .json({ message: "year debe ser un número entre 2000 y 2100" });
      return;
    }

    const companyOid = new mongoose.Types.ObjectId(adminCompanyId);

    // Same worker scope as checkPayrollCoverage: active workers only.
    const totalWorkers = await User.countDocuments({
      companyId: companyOid,
      role: "worker",
      isActive: true,
    });

    // Same confirmed coverage criteria as checkPayrollCoverage.
    const assignedByMonth = (await PayrollDocument.aggregate([
      {
        $match: {
          companyId: companyOid,
          year,
          matchStatus: { $in: ["manual", "matched"] },
          workerId: { $ne: null },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: "$month",
          assignedCount: { $sum: 1 },
        },
      },
    ])) as Array<{ _id: number | null; assignedCount: number }>;

    const assignedByMonthMap = new Map<number, number>();
    for (const item of assignedByMonth) {
      if (
        typeof item._id === "number" &&
        item._id >= 1 &&
        item._id <= 12
      ) {
        assignedByMonthMap.set(item._id, item.assignedCount);
      }
    }

    const months = Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      return {
        month,
        assignedCount: assignedByMonthMap.get(month) ?? 0,
      };
    });

    res.status(200).json({
      year,
      totalWorkers,
      months,
    });
  } catch (err) {
    console.error("[payroll] getPayrollCoverageYearSummary error:", err);
    res
      .status(500)
      .json({ message: "Error al obtener el resumen anual de cobertura" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/payroll/:id/invalidate
// Admin only. Soft-deletes a payroll document by setting deletedAt = now.
//
// Invalidated documents are excluded from all listings, coverage checks,
// duplicate detection, assignment, and file access. The DB record and the
// physical file on disk are retained to allow future restore.
//
// Attempting to invalidate an already-invalidated document returns 409.
// ─────────────────────────────────────────────────────────────────────────────
export async function invalidatePayrollDocument(
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
    const companyOid = new mongoose.Types.ObjectId(adminCompanyId);

    const payroll = await PayrollDocument.findOne({
      _id: new mongoose.Types.ObjectId(id),
      companyId: companyOid,
    }).select("_id deletedAt");

    if (!payroll) {
      res.status(404).json({ message: "Documento de nómina no encontrado" });
      return;
    }

    if (payroll.deletedAt !== null) {
      res.status(409).json({ message: "El documento ya está invalidado" });
      return;
    }

    payroll.deletedAt = new Date();
    await payroll.save();

    res.status(200).json({
      message: "Documento invalidado correctamente",
      payrollId: payroll._id,
    });
  } catch (err) {
    console.error("[payroll] invalidatePayrollDocument error:", err);
    res.status(500).json({ message: "Error al invalidar el documento" });
  }
}
