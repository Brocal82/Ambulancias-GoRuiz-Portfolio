import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 📁 Directorio donde se guardarán los archivos: backend/uploads
const uploadDir = path.join(__dirname, '../../uploads');

// Crea la carpeta si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// 🎯 Configuración del almacenamiento con nombre único
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// ✅ Solo aceptamos imágenes JPG/PNG y PDF
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('❌ Tipo de archivo no permitido. Solo JPG, PNG o PDF.'));
  }
};

// 🧠 Middleware listo para usar
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB máximo
  },
});
