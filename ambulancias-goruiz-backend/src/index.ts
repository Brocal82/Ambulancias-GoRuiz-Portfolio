// Cargamos las variables de entorno definidas en .env
import dotenv from 'dotenv';              // Para leer variables de entorno desde .env
dotenv.config();
// Importamos módulos necesarios
import express from 'express';            // Framework para construir APIs
import mongoose from 'mongoose';          // ODM para conectarse y trabajar con MongoDB
import cors from 'cors';                  // Para permitir peticiones de distintos orígenes (CORS)
import userRoutes from './routes/userRoutes';  // Importamos las rutas de usuario
import dienstRoutes from './routes/dienstRoutes'


// Inicializamos Express
const app = express();

// Puerto de la aplicación, por defecto 5000 si no hay uno en .env
const PORT = process.env.PORT || 5000;

// Leemos la URI de conexión a MongoDB desde las variables de entorno
const MONGODB_URI = process.env.MONGODB_URI;

// Si no hay URI en el .env, mostramos error y detenemos la aplicación
if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI no está definida en el archivo .env');
  process.exit(1); // Finaliza el proceso con código de error
}

// Middlewares que procesan las peticiones entrantes
app.use(
  cors({
    origin: "http://localhost:5173", // 👈 tu frontend en desarrollo
    credentials: true,               // 👈 permite el uso de cookies/sesiones
  })
);

app.use(express.json());     // Permite leer el body en formato JSON

// Rutas de la API para usuarios
app.use('/api/users', userRoutes);

// Rutas de la API para dienst (horarios de trabajo)
app.use('/api/diensts', dienstRoutes);

// Conexión a la base de datos MongoDB y arranque del servidor
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('🟢 Conectado a MongoDB');

    // Una vez conectados a MongoDB, iniciamos el servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('🔴 Error de conexión a MongoDB:', err);
  });
