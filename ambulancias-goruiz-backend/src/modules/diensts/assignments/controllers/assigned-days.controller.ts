import { RequestHandler } from "express";
import { resolveAccessibleUserId } from "../../../../utils/resolveAccessibleUserId";
import { isSameCompany } from "../../../../utils/requireCompany";
import User from "../../../users/models/user.model";
import * as assignmentsService from "../services/assignments.service";

export const getAssignedDaysForUser: RequestHandler = async (req, res) => {
  const result = resolveAccessibleUserId(req, req.params.userId);

  if (!result.ok) {
    res.status(result.statusCode).json({ message: result.message });
    return;
  }

  let userCompanyId: string | null = req.companyId ?? null;
  if (req.userRole === "admin" && req.params.userId && req.params.userId !== req.userId) {
    const targetUser = await User.findById(result.userId).select("companyId").lean();
    if (!targetUser || !isSameCompany(targetUser.companyId, req.companyId ?? null)) {
      res.status(403).json({ message: "No tienes permiso para ver asignaciones de este usuario" });
      return;
    }
    userCompanyId = targetUser.companyId ? String(targetUser.companyId) : null;
  }

  try {
    const assignedDays = await assignmentsService.getAssignedDaysForUser(
      result.userId,
      userCompanyId,
    );
    res.status(200).json(assignedDays);
  } catch (error) {
    console.error("❌ Error al obtener días asignados:", error);
    res.status(500).json({ message: "Error al obtener días asignados" });
  }
};
