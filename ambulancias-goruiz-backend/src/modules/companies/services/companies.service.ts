import mongoose from "mongoose";
import Company from "../models/company.model";
import type { CreateCompanyInput, UpdateCompanyInput } from "../schemas/company.schema";

export async function createCompany(
  data: CreateCompanyInput,
  createdBy?: string,
) {
  const doc: Record<string, unknown> = {
    name: data.name,
    isActive: data.isActive ?? true,
  };
  if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
    doc.createdBy = new mongoose.Types.ObjectId(createdBy);
  }
  const company = new Company(doc);
  return await company.save();
}

export async function getAllCompanies() {
  return await Company.find().sort({ createdAt: -1 }).lean();
}

export async function getCompanyById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Company.findById(id).lean();
}

export async function updateCompany(id: string, data: UpdateCompanyInput) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Company.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true },
  ).lean();
}
