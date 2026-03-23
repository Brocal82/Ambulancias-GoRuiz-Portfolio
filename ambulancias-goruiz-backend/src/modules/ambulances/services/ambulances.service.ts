import mongoose from "mongoose";
import { Ambulance } from "../models/ambulance.model";
import type { IAmbulance } from "../models/ambulance.model";

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function throwDuplicateKeyError(): never {
  const err = new Error("Ya existe una ambulancia con esa matrícula o número");
  (err as { status?: number }).status = 400;
  throw err;
}

function companyFilter(companyId?: string | null): Record<string, unknown> {
  if (companyId) return { companyId: new mongoose.Types.ObjectId(companyId) };
  return { $or: [{ companyId: null }, { companyId: { $exists: false } }] };
}

export const getAllAmbulances = async (
  companyId?: string | null
): Promise<IAmbulance[]> => {
  const filter = companyFilter(companyId);
  return await Ambulance.find(filter);
};

export const getAmbulanceById = async (
  id: string,
  companyId?: string | null
): Promise<IAmbulance | null> => {
  const filter = companyFilter(companyId);
  return await Ambulance.findOne({ _id: id, ...filter });
};

export const createAmbulance = async (
  data: Record<string, unknown>,
  companyId?: string | null
): Promise<IAmbulance> => {
  try {
    const payload =
      companyId != null && companyId !== ""
        ? { ...data, companyId: new mongoose.Types.ObjectId(companyId) }
        : data;
    const newAmbulance = new Ambulance(payload);
    return await newAmbulance.save();
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throwDuplicateKeyError();
    }
    throw error;
  }
};

export const updateAmbulance = async (
  id: string,
  data: Record<string, unknown>,
  companyId?: string | null
): Promise<IAmbulance | null> => {
  const existing = await Ambulance.findById(id).select("companyId").lean();
  if (!existing) return null;
  const existingCompany = (existing as { companyId?: unknown }).companyId;
  if (existingCompany && companyId != null && companyId !== "") {
    if (String(existingCompany) !== String(companyId)) return null;
  } else if (existingCompany) {
    return null;
  }
  try {
    const updated = await Ambulance.findByIdAndUpdate(id, data, {
      new: true,
    });
    return updated;
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throwDuplicateKeyError();
    }
    throw error;
  }
};

export const deleteAmbulance = async (
  id: string,
  companyId?: string | null
): Promise<IAmbulance | null> => {
  const existing = await Ambulance.findById(id).select("companyId").lean();
  if (!existing) return null;
  const existingCompany = (existing as { companyId?: unknown }).companyId;
  if (existingCompany && companyId != null && companyId !== "") {
    if (String(existingCompany) !== String(companyId)) return null;
  } else if (existingCompany) {
    return null;
  }
  return await Ambulance.findByIdAndDelete(id);
};
