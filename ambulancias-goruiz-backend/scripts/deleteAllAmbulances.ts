// scripts/deleteAllAmbulances.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Ambulance } from "../src/modules/ambulances";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "";

const run = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    await Ambulance.deleteMany();
    console.log("🗑️ Todas las ambulancias han sido eliminadas.");
  } catch (err) {
    console.error("❌ Error eliminando ambulancias:", err);
  } finally {
    mongoose.disconnect();
  }
};

run();
