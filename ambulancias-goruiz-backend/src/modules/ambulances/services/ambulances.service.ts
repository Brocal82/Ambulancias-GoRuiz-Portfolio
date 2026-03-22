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

export const getAllAmbulances = async (): Promise<IAmbulance[]> => {
  return await Ambulance.find();
};

export const getAmbulanceById = async (
  id: string
): Promise<IAmbulance | null> => {
  return await Ambulance.findById(id);
};

export const createAmbulance = async (
  data: Record<string, unknown>
): Promise<IAmbulance> => {
  try {
    const newAmbulance = new Ambulance(data);
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
  data: Record<string, unknown>
): Promise<IAmbulance | null> => {
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
  id: string
): Promise<IAmbulance | null> => {
  return await Ambulance.findByIdAndDelete(id);
};
