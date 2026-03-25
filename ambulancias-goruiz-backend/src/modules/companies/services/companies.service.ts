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
  if (data.emailDomain) {
    doc.emailDomain = data.emailDomain;
  }
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
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, string> = {};
  if (data.name !== undefined) $set.name = data.name;
  if (data.isActive !== undefined) $set.isActive = data.isActive;
  if (data.emailDomain === null) {
    $unset.emailDomain = "";
  } else if (data.emailDomain !== undefined) {
    $set.emailDomain = data.emailDomain;
  }
  const update: Record<string, unknown> = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;
  if (Object.keys(update).length === 0) {
    return await Company.findById(id).lean();
  }
  return await Company.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();
}
