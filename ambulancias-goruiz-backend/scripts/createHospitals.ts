import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Hospital } from '../src/models/Hospital';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

const hospitals = [
  {
    name: 'Hospital Central',
    address: 'Calle Mayor 123, Madrid',
    phone: '912345678',
    specialties: ['Cardiología', 'Pediatría', 'Traumatología'],
    isOpen: true,
  },
  {
    name: 'Clínica Salud',
    address: 'Avenida de la Salud 45, Barcelona',
    phone: '931234567',
    specialties: ['Dermatología', 'Neurología'],
    isOpen: true,
  },
  {
    name: 'Hospital del Norte',
    address: 'Carretera Norte Km 10, Bilbao',
    phone: '944567890',
    specialties: ['Urgencias', 'Oncología'],
    isOpen: false,
  },
];

const seedHospitals = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    await Hospital.deleteMany();
    const created = await Hospital.insertMany(hospitals);
    console.log(`✅ ${created.length} hospitales creados`);
    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error al crear hospitales:', err);
    process.exit(1);
  }
};

seedHospitals();
