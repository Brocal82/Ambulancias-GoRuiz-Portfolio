// backend/src/models/Ambulance.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IAmbulance extends Document {
  brand: string;
  modelName: string;      // renombrado de model a modelName
  licensePlate: string;
  ambulanceNumber: string;
}

const ambulanceSchema = new Schema<IAmbulance>({
  brand: { type: String, required: true },
  modelName: { type: String, required: true }, // cambio aquí también
  licensePlate: { type: String, required: true, unique: true },
  ambulanceNumber: { type: String, required: true, unique: true },
});

const Ambulance = mongoose.model<IAmbulance>('Ambulance', ambulanceSchema);
export default Ambulance;
