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

  /** Solo lo envía el front en modo admin editando otro usuario; backend solo aplica si el requester es admin */
  employeeNumber?: string;
}

export interface UploadUserFilesPayload {
  profileImage?: File | null;
  documents?: FileList | File[] | null;
}
