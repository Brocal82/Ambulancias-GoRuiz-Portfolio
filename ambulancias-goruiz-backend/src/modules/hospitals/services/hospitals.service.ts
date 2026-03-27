import mongoose from "mongoose";
import { Hospital } from "../models/hospital.model";
import type { UpdateHospitalInput } from "../schemas/hospital.schema";

export const getAllHospitals = async (companyId?: string | null) => {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }
  return await Hospital.find({ companyId: new mongoose.Types.ObjectId(raw) });
};

export const createHospital = async (
  data: {
    name: string;
    address: string;
    phone: string;
    specialties: string[];
    isOpen?: boolean;
  },
  companyId?: string | null,
) => {
  const doc: Record<string, unknown> = {
    name: data.name,
    address: data.address,
    phone: data.phone,
    specialties: data.specialties,
    isOpen: data.isOpen,
  };
  if (companyId != null && companyId !== "") {
    doc.companyId = new mongoose.Types.ObjectId(companyId);
  }
  const hospital = new Hospital(doc);
  return await hospital.save();
};

export const updateHospital = async (
  id: string,
  updateData: UpdateHospitalInput,
  companyId?: string | null,
) => {
  const existing = await Hospital.findById(id).select("companyId").lean();
  if (!existing) return null;
  const existingCompany = (existing as { companyId?: unknown }).companyId;
  if (existingCompany && companyId != null && companyId !== "") {
    if (String(existingCompany) !== String(companyId)) return null;
  } else if (existingCompany) {
    return null;
  }
  return await Hospital.findByIdAndUpdate(id, updateData, { new: true });
};

export const deleteHospital = async (
  id: string,
  companyId?: string | null,
) => {
  const existing = await Hospital.findById(id).select("companyId").lean();
  if (!existing) return null;
  const existingCompany = (existing as { companyId?: unknown }).companyId;
  if (existingCompany && companyId != null && companyId !== "") {
    if (String(existingCompany) !== String(companyId)) return null;
  } else if (existingCompany) {
    return null;
  }
  return await Hospital.findByIdAndDelete(id);
};
