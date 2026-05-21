import mongoose from "mongoose";
import { Hospital } from "../models/hospital.model";
import type {
  CreateHospitalInput,
  UpdateHospitalInput,
} from "../schemas/hospital.schema";
import {
  findHospitalReferences,
  HospitalInUseError,
} from "../utils/hospitalReferences";

function toCompanyObjectId(companyId?: string | null): mongoose.Types.ObjectId | null {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return null;
  }
  return new mongoose.Types.ObjectId(raw);
}

export const getAllHospitals = async (companyId?: string | null) => {
  const oid = toCompanyObjectId(companyId);
  if (!oid) {
    return [];
  }
  return await Hospital.find({ companyId: oid });
};

export const createHospital = async (
  data: CreateHospitalInput,
  companyId: string,
) => {
  const oid = toCompanyObjectId(companyId);
  if (!oid) {
    throw new Error("createHospital: companyId inválido o ausente");
  }
  const hospital = new Hospital({
    name: data.name,
    address: data.address,
    phone: data.phone,
    specialties: data.specialties,
    isOpen: data.isOpen,
    companyId: oid,
  });
  return await hospital.save();
};

export const updateHospital = async (
  id: string,
  updateData: UpdateHospitalInput,
  companyId?: string | null,
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const oid = toCompanyObjectId(companyId);
  if (!oid) {
    return null;
  }
  return await Hospital.findOneAndUpdate(
    { _id: id, companyId: oid },
    updateData,
    { new: true, runValidators: true },
  );
};

export const deleteHospital = async (id: string, companyId?: string | null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const oid = toCompanyObjectId(companyId);
  if (!oid) {
    return null;
  }

  const existing = await Hospital.findOne({ _id: id, companyId: oid }).lean();
  if (!existing) {
    return null;
  }

  const refs = await findHospitalReferences(
    { name: existing.name, address: existing.address },
    String(oid),
  );
  if (refs.inUse) {
    throw new HospitalInUseError(refs.sources);
  }

  return await Hospital.findOneAndDelete({ _id: id, companyId: oid });
};
