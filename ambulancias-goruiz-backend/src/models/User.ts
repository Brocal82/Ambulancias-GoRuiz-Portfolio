import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  lastName: string; // ✅ Añadir aquí
  email: string;
  password: string;
  role: 'admin' | 'worker';
  ambulanceRole: 'driver' | 'medic' | 'both'; // ✅ NUEVO CAMPO
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  lastName: { type: String, required: true }, // ✅ NUEVO
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
    enum: ['driver', 'medic', 'both'], // ✅ Limita las opciones
    required: false, // ✅ Permite que se complete luego en el perfil
  },
});

const User = mongoose.model<IUser>('User', userSchema);
export default User;
