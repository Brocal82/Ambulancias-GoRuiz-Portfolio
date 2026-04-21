import mongoose from "mongoose";
import Company from "../models/company.model";
import User from "../../users/models/user.model";
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
  if (Array.isArray(data.enabledModules)) {
    doc.enabledModules = data.enabledModules;
  }
  doc.praemienMode = data.praemienMode ?? "automatic";
  if (data.praemienModeEffectiveFrom !== undefined) {
    doc.praemienModeEffectiveFrom = data.praemienModeEffectiveFrom;
  } else {
    doc.praemienModeEffectiveFrom = null;
  }
  if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
    doc.createdBy = new mongoose.Types.ObjectId(createdBy);
  }
  const company = new Company(doc);
  return await company.save();
}

export async function getAllCompanies() {
  const companies = await Company.find().sort({ createdAt: -1 }).lean();

  const [workerCounts, adminCounts] = await Promise.all([
    User.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { companyId: { $exists: true } } },
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
    ]),
    User.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { companyId: { $exists: true }, role: "admin" } },
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
    ]),
  ]);

  const workerMap = new Map(workerCounts.map((c) => [c._id.toString(), c.count]));
  const adminMap = new Map(adminCounts.map((c) => [c._id.toString(), c.count]));

  return companies.map((company) => ({
    ...company,
    workerCount: workerMap.get(company._id.toString()) ?? 0,
    adminCount: adminMap.get(company._id.toString()) ?? 0,
  }));
}

export async function getCompanyById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Company.findById(id).lean();
}

export async function deleteCompany(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Company.findByIdAndDelete(id).lean();
}

export async function getCompanyAdmins(companyId: string) {
  if (!mongoose.Types.ObjectId.isValid(companyId)) return [];
  return await User.find(
    { companyId: new mongoose.Types.ObjectId(companyId), role: "admin" },
    { name: 1, lastName: 1, email: 1, _id: 1 },
  ).lean();
}

export async function updateCompany(id: string, data: UpdateCompanyInput) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, string> = {};
  if (data.name !== undefined) $set.name = data.name;
  if (data.isActive !== undefined) $set.isActive = data.isActive;
  if (Array.isArray(data.enabledModules)) {
    $set.enabledModules = data.enabledModules;
  }
  if (data.praemienMode !== undefined) {
    $set.praemienMode = data.praemienMode;
  }
  if (data.praemienModeEffectiveFrom !== undefined) {
    $set.praemienModeEffectiveFrom = data.praemienModeEffectiveFrom;
  }
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
