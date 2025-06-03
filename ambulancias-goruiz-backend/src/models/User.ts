import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  lastName: string;
  email: string;
  password: string;
  role: 'admin' | 'worker';
  ambulanceRole?: 'driver' | 'medic' | 'both';
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  pscheinExpiry?: string; // Formato ISO, ej: '2025-12-31'
  profileImage?: string;  // URL o base64 si usas subida
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'worker'],
    default: 'worker',
    required: true,
  },
  ambulanceRole: {
    type: String,
    enum: ['driver', 'medic', 'both'],
    required: false, // se puede completar luego
  },
  address: {
    type: String,
    required: false,
  },
  phone: {
    type: String,
    required: false,
  },
  emergencyPhone: {
    type: String,
    required: false,
  },
  pscheinExpiry: {
    type: String, // ISO 8601 format: 'YYYY-MM-DD'
    required: false,
  },
  profileImage: {
    type: String,
    required: false,
  },
});

const User = mongoose.model<IUser>('User', userSchema);
export default User;
