export interface IUser {
  name: string;
  lastName: string;
  email: string;
  password: string;

  role?: "admin" | "worker"; // Opcional si se completa en otro momento
  ambulanceRole?: "driver" | "medic" | "both"; // También opcional

  address?: string;
  phone?: string;
  emergencyPhone?: string;
  pscheinExpiry?: string; // Usaremos formato ISO tipo '2025-12-31'
  /** ISO string in API JSON */
  pscheinConfirmedAt?: string;
  pscheinConfirmedBy?: string;
  pscheinDocumentPath?: string;
  profileImage?: string; // URL o base64 si se quiere subir
  documents?: string[]; // Rutas a archivos subidos (ej. PDF)
  rotationMode?: "rotating" | "fixed" | "none";
  fixedDienstNumber?: number | null;
}
