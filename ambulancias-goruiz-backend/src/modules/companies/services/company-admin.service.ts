import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Company from "../models/company.model";
import User from "../../users/models/user.model";

export class CompanyAdminError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "CompanyAdminError";
  }
}

export async function createFirstAdminForCompany(
  companyId: string,
  body: { name: string; lastName: string; email: string; password: string },
) {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new CompanyAdminError("ID de empresa inválido", 400);
  }

  const company = await Company.findById(companyId).lean();
  if (!company) {
    throw new CompanyAdminError("Empresa no encontrada", 404);
  }

  const existing = await User.findOne({ email: body.email }).lean();
  if (existing) {
    throw new CompanyAdminError("El email ya está registrado", 409);
  }

  const hashedPassword = await bcrypt.hash(body.password, 10);
  const user = await User.create({
    name: body.name.trim(),
    lastName: body.lastName.trim(),
    email: body.email.trim().toLowerCase(),
    password: hashedPassword,
    role: "admin",
    companyId: new mongoose.Types.ObjectId(companyId),
  });

  return user;
}
