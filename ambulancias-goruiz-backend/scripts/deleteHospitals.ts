import mongoose from "mongoose";
import dotenv from "dotenv";
import { Hospital } from "../src/modules/hospitals/models/hospital.model";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "";

const deleteAllHospitals = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    const result = await Hospital.deleteMany();
    console.log(`🗑️ ${result.deletedCount} hospitales eliminados`);
    mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error al eliminar hospitales:", err);
    process.exit(1);
  }
};

deleteAllHospitals();
