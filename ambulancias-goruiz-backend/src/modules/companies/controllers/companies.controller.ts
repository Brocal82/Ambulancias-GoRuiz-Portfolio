import { Request, Response } from "express";
import * as companiesService from "../services/companies.service";
import { createCompanySchema, updateCompanySchema } from "../schemas/company.schema";

export const createCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCompanySchema.parse(req.body);
    const company = await companiesService.createCompany(
      parsed,
      req.userId ?? undefined,
    );
    res.status(201).json(company);
  } catch (error) {
    const err = error as { message?: string; errors?: unknown[] };
    if (err.errors) {
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    res.status(400).json({ message: err.message ?? "Error al crear empresa" });
  }
};

export const getAllCompanies = async (_req: Request, res: Response): Promise<void> => {
  try {
    const companies = await companiesService.getAllCompanies();
    res.status(200).json(companies);
  } catch {
    res.status(500).json({ message: "Error al obtener empresas" });
  }
};

export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const company = await companiesService.getCompanyById(req.params.id);
    if (!company) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json(company);
  } catch {
    res.status(500).json({ message: "Error al obtener empresa" });
  }
};

export const getMyCompany = async (req: Request, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({
      message: "No perteneces a una empresa o falta companyId en la sesión.",
    });
    return;
  }
  try {
    const company = await companiesService.getCompanyById(companyId);
    if (!company) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json(company);
  } catch {
    res.status(500).json({ message: "Error al obtener empresa" });
  }
};

export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await companiesService.deleteCompany(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json({ message: "Empresa eliminada correctamente" });
  } catch {
    res.status(500).json({ message: "Error al eliminar la empresa" });
  }
};

export const getCompanyAdmins = async (req: Request, res: Response): Promise<void> => {
  try {
    const admins = await companiesService.getCompanyAdmins(req.params.id);
    res.status(200).json(admins);
  } catch {
    res.status(500).json({ message: "Error al obtener administradores" });
  }
};

export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateCompanySchema.parse(req.body);
    const company = await companiesService.updateCompany(req.params.id, parsed);
    if (!company) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json(company);
  } catch (error) {
    const err = error as { message?: string; errors?: unknown[] };
    if (err.errors) {
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    res.status(400).json({ message: err.message ?? "Error al actualizar empresa" });
  }
};
