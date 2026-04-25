import mongoose from "mongoose";
import dotenv from "dotenv";
import { Hospital } from "../src/modules/hospitals/models/hospital.model";
import Company from "../src/modules/companies/models/company.model";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "";

const hospitals = [
  {
    name: "Hospital Central",
    address: "Calle Mayor 123, Madrid",
    phone: "912345678",
    specialties: ["Cardiología", "Pediatría", "Traumatología"],
    isOpen: true,
  },
  {
    name: "Clínica Salud",
    address: "Avenida de la Salud 45, Barcelona",
    phone: "931234567",
    specialties: ["Dermatología", "Neurología"],
    isOpen: true,
  },
  {
    name: "Hospital del Norte",
    address: "Carretera Norte Km 10, Bilbao",
    phone: "944567890",
    specialties: ["Urgencias", "Oncología"],
    isOpen: false,
  },
];

const seedHospitals = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    const company = await Company.findOne().select("_id").lean();
    if (!company) {
      console.error(
        "❌ No hay empresas en la BD. Crea al menos una company antes de sembrar hospitales.",
      );
      process.exit(1);
    }
    const companyId = (company as { _id: mongoose.Types.ObjectId })._id;
    await Hospital.deleteMany({ companyId });
    const created = await Hospital.insertMany(
      hospitals.map((h) => ({ ...h, companyId })),
    );
    console.log(`✅ ${created.length} hospitales creados para company ${companyId}`);
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error al crear hospitales:", err);
    process.exit(1);
  }
};

seedHospitals();
