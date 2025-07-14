//backend/src/models/Dienst.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDienstAssignment {
  _id?: Types.ObjectId;
  date: string;
  vehicleNumber: string;
  startTime: string;
  endTime: string;
  driver?: Types.ObjectId;  // ahora es opcional
  medic?: Types.ObjectId;   // ahora es opcional
}

export interface IDienst extends Document {
  dienstNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  assignments: IDienstAssignment[];
}

const AssignmentSchema = new Schema<IDienstAssignment>(
  {
    date: { type: String, required: true },
    vehicleNumber: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    medic: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { _id: true } // 👈 explícitamente indicamos que cada assignment debe tener su _id
);


const DienstSchema = new Schema<IDienst>({
  dienstNumber: { type: Number, required: true },
  weekStartDate: { type: Date, required: false },
  weekEndDate: { type: Date, required: false },
  assignments: [AssignmentSchema],
});

export default mongoose.model<IDienst>('Dienst', DienstSchema);
