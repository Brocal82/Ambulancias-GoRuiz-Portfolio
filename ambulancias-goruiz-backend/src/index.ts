// Cargamos las variables de entorno definidas en .env
import dotenv from 'dotenv';
dotenv.config();

// Importamos módulos necesarios
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path'; 
import userRoutes from './routes/userRoutes';
import dienstRoutes from './routes/dienstRoutes';
import hospitalRoutes from './routes/hospitalRoutes';
import tripRoutes from './routes/tripRoutes';
import workdaySummaryRoutes from './routes/workdaySummaryRoutes';
import praemienRoutes from './routes/praemienRoutes';
import vacationRoutes from './routes/vacationRoutes';
import ambulanceRoutes from './routes/ambulanceRoutes';
import messageRoutes from './routes/messageRoutes'; 
import appointmentRoutes from './routes/appointmentRoutes'

// ✅ Importamos el limpiador de Diensts antiguos
import cleanupOldDiensts from './utils/cleanupOldDiensts';

// Inicializamos Express
const app = express();

// Puerto de la aplicación
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Verificamos la URI
if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI no está definida en el archivo .env');
  process.exit(1);
}

// Middlewares
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// ✅ Servir archivos estáticos desde /uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
app.use('/api/users', userRoutes);
app.use('/api/diensts', dienstRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/workday-summary', workdaySummaryRoutes);
app.use('/api/praemien', praemienRoutes);
app.use('/api/vacations', vacationRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/messages', messageRoutes); // ✅ NUEVO
app.use('/api/appointments', appointmentRoutes);


// Conexión y arranque del servidor
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('🟢 Conectado a MongoDB');

    // ✅ Ejecutamos limpieza de Diensts antiguos automáticamente
    await cleanupOldDiensts();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('🔴 Error de conexión a MongoDB:', err);
  });
