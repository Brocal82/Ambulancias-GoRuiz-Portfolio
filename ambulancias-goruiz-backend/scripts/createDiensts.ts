import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Dienst from '../src/models/Dienst'; // Asegúrate de que esta ruta esté bien

dotenv.config();

const createTemplates = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);


  const startDate = new Date();
  const startOfWeek = new Date(startDate.setDate(startDate.getDate() - startDate.getDay() + 1));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const templates = Array.from({ length: 2 }, (_, i) => {
    const dienstNumber = i + 1;
    
    const assignments: {
      date: string;
      vehicleNumber: string;
      startTime: string;
      endTime: string;
      driver: string;
      medic: string;
    }[] = [];

    for (let j = 0; j < 7; j++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + j);

      const isDayOff = [5, 6].includes((dienstNumber + j) % 7);
      if (isDayOff) continue;

      const startTime = dienstNumber % 2 === 0 ? '06:00' : '14:00';
      const endTime = dienstNumber % 2 === 0 ? '14:00' : '22:00';

      assignments.push({
        date: date.toISOString().split('T')[0],
        vehicleNumber: `AMB-${dienstNumber.toString().padStart(2, '0')}`,
        startTime,
        endTime,
        driver: '000000000000000000000001',
        medic: '000000000000000000000002',
      });
    }

    return {
      dienstNumber,
      weekStartDate: startOfWeek,
      weekEndDate: endOfWeek,
      assignments,
    };
  });

  await Dienst.insertMany(templates);
  console.log('✅ Plantillas creadas correctamente');
  process.exit(0);
};

createTemplates().catch((err) => {
  console.error('❌ Error creando plantillas:', err);
  process.exit(1);
});


