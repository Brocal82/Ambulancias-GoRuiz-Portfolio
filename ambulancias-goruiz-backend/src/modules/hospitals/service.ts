// backend/src/modules/hospitals/service.ts
import { Hospital } from "./model";

export const getAllHospitals = async () => {
  return await Hospital.find();
};

export const createHospital = async (data: {
  name: string;
  address: string;
  phone: string;
  specialties: string[];
  isOpen?: boolean;
}) => {
  const hospital = new Hospital({
    name: data.name,
    address: data.address,
    phone: data.phone,
    specialties: data.specialties,
    isOpen: data.isOpen,
  });

  return await hospital.save();
};

export const updateHospital = async (id: string, updatedFields: Record<string, unknown>) => {
  return await Hospital.findByIdAndUpdate(id, updatedFields, { new: true });
};

export const deleteHospital = async (id: string) => {
  return await Hospital.findByIdAndDelete(id);
};
