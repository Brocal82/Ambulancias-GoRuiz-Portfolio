import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../../users/models/user.model";
import {
  attachDocumentToSickLeave,
  getSickLeaveDocumentTarget,
} from "../services/sick-documents.service";
import { requireCompanyForAdmin, isSameCompany } from "../../../utils/requireCompany";

export async function attachSickDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inv\u00E1lido" });
      return;
    }

    const { documentUrl } = (req.body || {}) as { documentUrl?: string };
    if (!documentUrl || typeof documentUrl !== "string") {
      res.status(400).json({ message: "documentUrl es requerido" });
      return;
    }

    const authId = req.userId;
    const isAdmin =
      req.user?.role === "admin" || req.userRole === "admin";

    const sick = await getSickLeaveDocumentTarget(id);
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
    if (isAdmin) {
      const companyResult = requireCompanyForAdmin(req);
      if (!companyResult.ok) {
        res.status(companyResult.statusCode).json({ message: companyResult.message });
        return;
      }
      let matchAttach: boolean;
      if (sick.companyId) {
        // New record (Phase 1+): direct check
        matchAttach = String(sick.companyId) === String(companyResult.companyId);
      } else {
        // Legacy record (companyId null): existing indirect check, unchanged
        const userDoc = await User.findById(sick.user).select("companyId").lean();
        const userCo = userDoc ? (userDoc as { companyId?: unknown }).companyId : null;
        matchAttach = isSameCompany(userCo, companyResult.companyId);
      }
      if (!matchAttach) {
        res.status(403).json({ message: "No tienes permiso para adjuntar documento a esta baja" });
        return;
      }
    }

    await attachDocumentToSickLeave({ sick, documentUrl });

    res.status(200).json({
      message: "Documento (URL) adjuntado correctamente",
      sickLeaveId: sick._id,
      verificationStatus: sick.verificationStatus,
      documentUrl: sick.documentUrl,
      documents: (sick as any).documents,
    });
  } catch (err) {
    console.error("\u274C attachSickDocument error:", err);
    res.status(500).json({ message: "Error al adjuntar el documento" });
  }
}

export async function attachSickDocumentFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inv\u00E1lido" });
      return;
    }

    const file = (req as any)?.file as
      | { location?: string; path?: string; filename?: string }
      | undefined;

    if (!file) {
      res
        .status(400)
        .json({
          message: "No se recibi\u00F3 ning\u00FAn archivo. Usa el campo 'document'.",
        });
      return;
    }

    let documentUrl: string | undefined;
    if (file.location && typeof file.location === "string") {
      documentUrl = file.location;
    } else if (file.filename && typeof file.filename === "string") {
      documentUrl = `/uploads/${file.filename}`;
    } else if (file.path && typeof file.path === "string") {
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

    const authId = req.userId;
    const isAdmin =
      req.user?.role === "admin" || req.userRole === "admin";

    const sick = await getSickLeaveDocumentTarget(id);
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
    if (isAdmin) {
      const companyResult = requireCompanyForAdmin(req);
      if (!companyResult.ok) {
        res.status(companyResult.statusCode).json({ message: companyResult.message });
        return;
      }
      let matchAttachFile: boolean;
      if (sick.companyId) {
        // New record (Phase 1+): direct check
        matchAttachFile = String(sick.companyId) === String(companyResult.companyId);
      } else {
        // Legacy record (companyId null): existing indirect check, unchanged
        const userDoc = await User.findById(sick.user).select("companyId").lean();
        const userCo = userDoc ? (userDoc as { companyId?: unknown }).companyId : null;
        matchAttachFile = isSameCompany(userCo, companyResult.companyId);
      }
      if (!matchAttachFile) {
        res.status(403).json({ message: "No tienes permiso para adjuntar documento a esta baja" });
        return;
      }
    }

    const normalizedDocumentUrl = documentUrl.replace(/\\/g, "/");
    await attachDocumentToSickLeave({
      sick,
      documentUrl: normalizedDocumentUrl,
    });

    res.status(200).json({
      message: "Documento (archivo) adjuntado correctamente",
      sickLeaveId: sick._id,
      verificationStatus: sick.verificationStatus,
      documentUrl: sick.documentUrl,
      documents: (sick as any).documents,
    });
  } catch (err) {
    console.error("\u274C attachSickDocumentFile error:", err);
    res
      .status(500)
      .json({ message: "Error al adjuntar el documento (archivo)" });
  }
}
