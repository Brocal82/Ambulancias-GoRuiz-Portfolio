// Cargamos las variables de entorno definidas en .env
import dotenv from 'dotenv';
dotenv.config();

// Importamos módulos necesarios
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import dienstRoutes from './routes/dienstRoutes';

// ✅ Importamos el limpiador de Diensts antiguos
import  cleanupOldDiensts  from './utils/cleanupOldDiensts';

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

// Rutas
app.use('/api/users', userRoutes);
app.use('/api/diensts', dienstRoutes);

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
