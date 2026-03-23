import { Request, Response } from "express";
import * as companyAdminService from "../services/company-admin.service";
import { createCompanyAdminSchema } from "../schemas/create-admin.schema";
import { CompanyAdminError } from "../services/company-admin.service";

export const createFirstAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCompanyAdminSchema.parse(req.body);
    const user = await companyAdminService.createFirstAdminForCompany(
      req.params.id,
      parsed,
    );
    res.status(201).json({
      message: "Admin de empresa creado correctamente",
      user: {
        _id: user._id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    });
  } catch (error) {
    if (error instanceof CompanyAdminError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    const err = error as { message?: string; errors?: unknown[] };
    if (err.errors) {
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    res.status(500).json({ message: "Error al crear admin de empresa" });
  }
};
