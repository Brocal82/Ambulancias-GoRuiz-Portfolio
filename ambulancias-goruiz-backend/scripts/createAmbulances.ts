// scripts/createAmbulances.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Ambulance } from "../src/modules/ambulances";
import Company from "../src/modules/companies/models/company.model";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "";

const ambulances = [
  {
    brand: "Mercedes",
    modelName: "Sprinter",
    licensePlate: "B-9401",
    ambulanceNumber: "AMB-01",
  },
  {
    brand: "Ford",
    modelName: "Transit",
    licensePlate: "B-9412",
    ambulanceNumber: "AMB-12",
  },
  {
    brand: "Volkswagen",
    modelName: "Crafter",
    licensePlate: "B-9418",
    ambulanceNumber: "AMB-18",
  },
  {
    brand: "Renault",
    modelName: "Master",
    licensePlate: "B-9425",
    ambulanceNumber: "AMB-25",
  },
  {
    brand: "Citroën",
    modelName: "Jumper",
    licensePlate: "B-9437",
    ambulanceNumber: "AMB-37",
  },
];

const run = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    const company = await Company.findOne().select("_id").lean();
    if (!company) {
      console.error(
        "❌ No hay empresas en la BD. Crea al menos una company antes de sembrar ambulancias.",
      );
      process.exit(1);
    }
    const companyId = (company as { _id: mongoose.Types.ObjectId })._id;
    await Ambulance.deleteMany({ companyId });
    const created = await Ambulance.insertMany(
      ambulances.map((a) => ({ ...a, companyId })),
    );
    console.log(
      `✅ ${created.length} ambulancias creadas para company ${companyId}.`,
    );
  } catch (err) {
    console.error("❌ Error creando ambulancias:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
