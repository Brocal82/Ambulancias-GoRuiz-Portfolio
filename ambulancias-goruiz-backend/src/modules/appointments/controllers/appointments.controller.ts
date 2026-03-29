import { Request, Response } from "express";
import * as appointmentsService from "../services/appointments.service";
import { AppointmentError } from "../services/appointments.service";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";

export const requestAppointment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const workerId = req.userId as string;
    const created = await appointmentsService.requestAppointment(workerId, req.body, req.companyId);
    res.status(201).json(created);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("requestAppointment error:", err);
    res
      .status(500)
      .json({ message: (err as Error)?.message || "Error al crear la solicitud." });
  }
};

export const getMyAppointments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const workerId = req.userId as string;
    const items = await appointmentsService.getMyAppointments(workerId);
    res.status(200).json(items);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("getMyAppointments error:", err);
    res.status(500).json({ message: "Error al obtener tus citas." });
  }
};

export const getPendingAppointments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const items = await appointmentsService.getPendingAppointments(
      companyResult.companyId,
    );
    res.status(200).json(items);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("getPendingAppointments error:", err);
    res.status(500).json({ message: "Error al listar pendientes." });
  }
};

export const getOpenAppointments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const items = await appointmentsService.getOpenAppointments(
      companyResult.companyId,
    );
    res.status(200).json(items);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("getOpenAppointments error:", err);
    res.status(500).json({ message: "Error al listar pendientes/propuestas." });
  }
};

export const proposeSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const adminId = req.userId as string;
    const { id } = req.params;
    const saved = await appointmentsService.proposeSlots(
      adminId,
      id,
      req.body,
      companyResult.companyId,
    );
    res.status(200).json(saved);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("proposeSlots error:", err);
    res
      .status(400)
      .json({ message: (err as Error)?.message || "Error al proponer horarios." });
  }
};

export const selectSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const workerId = req.userId as string;
    const { id } = req.params;
    const saved = await appointmentsService.selectSlot(workerId, id, req.body);
    res.status(200).json(saved);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("selectSlot error:", err);
    res
      .status(400)
      .json({ message: (err as Error)?.message || "Error al seleccionar horario." });
  }
};

export const getCalendarAppointments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const { from, to } = req.query as { from?: string; to?: string };
    const items = await appointmentsService.getCalendarAppointments(
      { from, to },
      companyResult.companyId,
    );
    res.status(200).json(items);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("getCalendarAppointments error:", err);
    res.status(500).json({ message: "Error al obtener calendario." });
  }
};

export const updateAppointment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const adminId = req.userId as string;
    const { id } = req.params;
    const saved = await appointmentsService.updateAppointment(
      adminId,
      id,
      req.body,
      companyResult.companyId,
    );
    res.status(200).json(saved);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("updateAppointment error:", err);
    res
      .status(400)
      .json({ message: (err as Error)?.message || "Error al actualizar la cita." });
  }
};

export const cancelAppointment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const adminId = req.userId as string;
    const { id } = req.params;
    const saved = await appointmentsService.cancelAppointment(
      adminId,
      id,
      companyResult.companyId,
    );
    res.status(200).json(saved);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("cancelAppointment error:", err);
    res.status(500).json({ message: "Error al cancelar la cita." });
  }
};

export const deleteMyAppointment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const workerId = req.userId as string;
    const { id } = req.params;
    await appointmentsService.deleteMyAppointment(workerId, id);
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("deleteMyAppointment error:", err);
    res.status(500).json({ message: "Error al eliminar la cita." });
  }
};

export const getAppointmentsCount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const rawStatus =
      typeof req.query.status === "string" ? req.query.status : "pending";
    const result = await appointmentsService.getAppointmentsCount(
      rawStatus,
      companyResult.companyId,
    );
    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof AppointmentError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("Error al contar citas por estado:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
