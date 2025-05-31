import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'worker';
  ambulanceRole: 'driver' | 'medic' | 'both'; // ✅ NUEVO CAMPO
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
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
    required: true,
  },
});

const User = mongoose.model<IUser>('User', userSchema);
export default User;
