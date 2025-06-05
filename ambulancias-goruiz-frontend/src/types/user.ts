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
  pscheinExpiry?: string;         // formato ISO 'YYYY-MM-DD'
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  profileImage?: string;          // URL o base64 si decides usarlo
}
