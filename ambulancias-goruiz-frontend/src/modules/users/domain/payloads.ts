import type { AmbulanceRole } from "./types";

export interface UpdateUserPayload {
  name: string;
  lastName: string;
  email: string;

  ambulanceRole?: AmbulanceRole;
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  pscheinExpiry?: string;

  /** Cadena vacía "" significa eliminar imagen */
  profileImage?: string;
}

export interface UploadUserFilesPayload {
  profileImage?: File | null;
  documents?: FileList | File[] | null;
}
