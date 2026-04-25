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

function toCompanyObjectId(companyId?: string | null): mongoose.Types.ObjectId | null {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return null;
  }
  return new mongoose.Types.ObjectId(raw);
}

function companyFilter(companyId?: string | null): Record<string, unknown> {
  const oid = toCompanyObjectId(companyId);
  if (!oid) {
    return { _id: { $in: [] } };
  }
  return { companyId: oid };
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const filter = companyFilter(companyId);
  return await Ambulance.findOne({ _id: id, ...filter });
};

export const createAmbulance = async (
  data: Record<string, unknown>,
  companyId: string
): Promise<IAmbulance> => {
  const oid = toCompanyObjectId(companyId);
  if (!oid) {
    throw new Error("createAmbulance: companyId inválido o ausente");
  }
  try {
    const newAmbulance = new Ambulance({
      ...data,
      companyId: oid,
    });
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const oid = toCompanyObjectId(companyId);
  if (!oid) {
    return null;
  }
  try {
    return await Ambulance.findOneAndUpdate(
      { _id: id, companyId: oid },
      data,
      { new: true, runValidators: true },
    );
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const oid = toCompanyObjectId(companyId);
  if (!oid) {
    return null;
  }
  return await Ambulance.findOneAndDelete({ _id: id, companyId: oid });
};
