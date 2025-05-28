import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDienstAssignment {
  date: string;
  vehicleNumber: string;
  startTime: string;
  endTime: string;
  driver: Types.ObjectId;
  medic: Types.ObjectId;
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
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    medic: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
);

const DienstSchema = new Schema<IDienst>({
  dienstNumber: { type: Number, required: true },
  weekStartDate: { type: Date, required: true },
  weekEndDate: { type: Date, required: true },
  assignments: [AssignmentSchema],
});

export default mongoose.model<IDienst>('Dienst', DienstSchema);
