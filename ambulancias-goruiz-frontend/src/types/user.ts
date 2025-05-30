export type UserRole = 'driver' | 'medic' | 'both';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}
