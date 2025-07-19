// scripts/createAmbulances.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ambulance from '../src/models/Ambulance';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

const ambulances = [
  { brand: 'Mercedes', modelName: 'Sprinter', licensePlate: 'B-9401', ambulanceNumber: 'AMB-01' },
  { brand: 'Ford', modelName: 'Transit', licensePlate: 'B-9412', ambulanceNumber: 'AMB-12' },
  { brand: 'Volkswagen', modelName: 'Crafter', licensePlate: 'B-9418', ambulanceNumber: 'AMB-18' },
  { brand: 'Renault', modelName: 'Master', licensePlate: 'B-9425', ambulanceNumber: 'AMB-25' },
  { brand: 'Citroën', modelName: 'Jumper', licensePlate: 'B-9437', ambulanceNumber: 'AMB-37' },
];

const run = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    await Ambulance.deleteMany(); // limpia si hace falta
    await Ambulance.insertMany(ambulances);
    console.log('✅ Ambulancias creadas correctamente.');
  } catch (err) {
    console.error('❌ Error creando ambulancias:', err);
  } finally {
    mongoose.disconnect();
  }
};

run();
