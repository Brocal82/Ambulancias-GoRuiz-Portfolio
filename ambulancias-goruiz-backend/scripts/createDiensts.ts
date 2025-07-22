// scripts/createDienstTemplates.ts

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Dienst from '../src/models/Dienst';

dotenv.config();

const createTemplates = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("🔗 Conectado a MongoDB");

  const startDate = new Date();
  const startOfWeek = new Date(startDate.setDate(startDate.getDate() - startDate.getDay() + 1)); // lunes
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // domingo

  const templates = Array.from({ length: 2 }, (_, i) => {
    const dienstNumber = i + 1;

    const assignments: {
      date: string;
      startTime: string;
      endTime: string;
      ambulanceId?: string;
      driver?: string;
      medic?: string;
    }[] = [];


for (let j = 0; j < 7; j++) {
  const date = new Date(startOfWeek);
  date.setDate(startOfWeek.getDate() + j);

  const isDayOff = [5, 6].includes((dienstNumber + j) % 7);
  if (isDayOff) continue;

  const startTime = dienstNumber % 2 === 0 ? '06:00' : '14:00';
  const endTime = dienstNumber % 2 === 0 ? '14:00' : '22:00';

  const assignment: any = {
    date: date.toISOString().split("T")[0],
    startTime,
    endTime,
  };

  assignments.push(assignment);
}


    return {
      dienstNumber,
      weekStartDate: startOfWeek,
      weekEndDate: endOfWeek,
      assignments,
    };
  });

  await Dienst.insertMany(templates);
  console.log('✅ Plantillas de Dienst creadas sin asignaciones iniciales.');
  process.exit(0);
};

createTemplates().catch((err) => {
  console.error('❌ Error creando plantillas:', err);
  process.exit(1);
});
