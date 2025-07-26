// frontend/src/types/user.ts
export type AmbulanceRole = 'driver' | 'medic' | 'both';
export type AppRole = 'admin' | 'worker';

export interface User {
  _id: string;
  name: string;
  lastName: string;
  email: string;
  role: AppRole;
  ambulanceRole?: AmbulanceRole;
  pscheinExpiry?: string;
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  profileImage?: string;
  documents?: string[];

  // ✅ Nuevas propiedades para filtros futuros
  onLeave?: boolean;
  onVacation?: boolean;
}

