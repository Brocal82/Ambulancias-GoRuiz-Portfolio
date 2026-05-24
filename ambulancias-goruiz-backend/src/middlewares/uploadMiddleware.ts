//backend/src/middlewares/uploadMiddleware.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import { sanitizeMulterBasename } from "../utils/secureUploadFilename";

// 📁 Directorio donde se guardarán los archivos: backend/uploads
const uploadDir = path.join(__dirname, "../../uploads");

// Crear la carpeta si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 🎯 Configuración del almacenamiento con nombre único
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = sanitizeMulterBasename(
      path.basename(file.originalname, ext),
    );
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

// ✅ Tipos de archivo permitidos (imágenes + PDF)
const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("❌ Tipo de archivo no permitido. Solo JPG, PNG, WEBP o PDF."),
    );
  }
};

// 🧠 Middleware listo para usar
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB máximo
  },
});

const imageOnlyTypes = ["image/jpeg", "image/png", "image/webp"];

const imageOnlyFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (imageOnlyTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "❌ Tipo de archivo no permitido. Solo imágenes JPG, PNG o WEBP.",
      ),
    );
  }
};

/** Multer solo imágenes (p. ej. fotos de averías mechanics). Mismo límite de tamaño. */
export const uploadImagesOnly = multer({
  storage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const excelMimeTypes = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const excelFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk =
    excelMimeTypes.includes(file.mimetype) ||
    file.mimetype === "application/octet-stream";
  if (mimeOk || ext === ".xlsx" || ext === ".xls") {
    if (ext !== ".xlsx" && ext !== ".xls") {
      cb(new Error("❌ Solo se permiten archivos Excel (.xlsx / .xls)."));
      return;
    }
    cb(null, true);
    return;
  }
  cb(new Error("❌ Solo se permiten archivos Excel (.xlsx / .xls)."));
};

/** Multer solo Excel — rutas dedicadas al módulo excel-planning (no mezclar con PDF/imagen global). */
export const uploadExcelOnly = multer({
  storage,
  fileFilter: excelFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const pdfOnlyTypes = ["application/pdf"];

const pdfOnlyFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (pdfOnlyTypes.includes(file.mimetype) || ext === ".pdf") {
    cb(null, true);
    return;
  }
  cb(new Error("❌ Tipo de archivo no permitido. Solo PDF."));
};

/** Multer solo PDF — documentos de empresa (evita imágenes en /uploads). */
export const uploadPdfOnly = multer({
  storage,
  fileFilter: pdfOnlyFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
